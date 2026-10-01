import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const routes = ['overview', 'fixtures', 'squad', 'standings', 'news'];
const titles = { overview: '封面', fixtures: '比赛', squad: '人物', standings: '排名', news: '报道' };

// A small DOM boundary double keeps the real app's init and event handlers
// runnable with Node alone. Network failure is intentional: routing must work
// even when dashboard data is unavailable. This does not test browser layout.
async function openPage(hash = '') {
  const elements = [...html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)].map(([, tag, attrs]) => {
    const attributes = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
    const classes = new Set((attributes.class || '').split(/\s+/));
    const listeners = new Map();
    return {
      tag, attributes, id: attributes.id, textContent: '',
      dataset: Object.fromEntries(Object.entries(attributes).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value])),
      classList: { contains: value => classes.has(value), toggle: (value, on) => on ? classes.add(value) : classes.delete(value) },
      addEventListener: (name, callback) => listeners.set(name, callback),
      click() {
        const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
        assert.ok(listeners.has('click'), `No click handler for ${JSON.stringify(attributes)}`);
        listeners.get('click')(event);
        if (tag === 'a') assert.ok(event.defaultPrevented, 'Internal link must prevent native navigation');
      }
    };
  });
  const queryAll = selector => {
    if (selector === '.lineup-tabs button') selector = '[data-lineup]';
    if (selector === '.roster-filters button') selector = '[data-position]';
    const parts = selector.split(',').map(part => part.trim());
    return elements.filter(el => parts.some(part => part.startsWith('#') ? el.id === part.slice(1) : part.startsWith('.') ? el.classList.contains(part.slice(1)) : /^\[[\w-]+\]$/.test(part) && part.slice(1, -1) in el.attributes));
  };
  const events = new Map();
  const location = new URL(`https://example.test/dashboard/?keep=1${hash}`);
  let replacements = 0;
  const context = vm.createContext({
    URL, Intl, Date,
    document: { title: '', querySelectorAll: queryAll, querySelector: selector => queryAll(selector)[0] || null, addEventListener() {} },
    window: { location, scrollTo() {}, addEventListener: (name, callback) => events.set(name, callback) },
    history: { replaceState(_state, _unused, url) { location.href = new URL(url, location).href; replacements++; } },
    fetch: async () => ({ ok: false }), setInterval() {}
  });
  vm.runInContext(app, context);
  // init awaits loadLatestData before registering navigation handlers.
  await new Promise(resolve => setImmediate(resolve));
  return { context, elements, queryAll, location, replacements: () => replacements, changeHash(value) { location.hash = value; events.get('hashchange')(); } };
}

function expectRoute(page, route) {
  assert.equal(page.location.hash, `#${route}`, 'URL must match the selected view');
  assert.equal(page.location.pathname, '/dashboard/');
  assert.equal(page.location.search, '?keep=1');
  assert.equal(vm.runInContext('state.view', page.context), route);
  assert.deepEqual(page.queryAll('.view').filter(el => el.classList.contains('active')).map(el => el.id), [`${route}-view`]);
  for (const nav of ['.nav-item', '.mobile-nav-item']) {
    assert.deepEqual(page.queryAll(nav).filter(el => el.classList.contains('active')).map(el => el.dataset.view), [route]);
  }
  assert.equal(page.context.document.title, `${titles[route]} | UNITED 26/27`);
}

test('five views and both navigation bars have unique matching targets', async () => {
  const page = await openPage('#overview');
  const ids = page.elements.map(el => el.id).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
  assert.deepEqual(page.queryAll('.view').map(el => el.id), routes.map(route => `${route}-view`));
  for (const nav of ['.nav-item', '.mobile-nav-item']) assert.deepEqual(page.queryAll(nav).map(el => el.dataset.view), routes);
  for (const el of page.queryAll('[data-view], [data-view-link], [data-jump]')) {
    const route = el.dataset.view ?? el.dataset.viewLink ?? el.dataset.jump;
    assert.ok(routes.includes(route), `Missing view for ${route}`);
    if (el.dataset.viewLink) assert.equal(el.attributes.href, `#${route}`);
  }
  for (const [, id] of app.matchAll(/\$\('#([^']+)'\)/g)) assert.ok(ids.includes(id), `Missing render target #${id}`);
});

test('invalid and empty initial hashes normalize to overview', async () => {
  for (const hash of ['#bad-route', '#OVERVIEW', '#%E0%A4%A', '']) {
    const page = await openPage(hash);
    expectRoute(page, 'overview');
    assert.equal(page.replacements(), 1, 'Fallback replaces the current URL once');
  }
});

test('valid initial deep links preserve their route and URL', async () => {
  for (const route of routes) {
    const page = await openPage(`#${route}`);
    expectRoute(page, route);
    assert.equal(page.replacements(), 0);
  }
});

test('hash changes recover from invalid and cleared routes', async () => {
  const page = await openPage('#squad');
  page.changeHash('#bad-route');
  expectRoute(page, 'overview');
  page.changeHash('#fixtures');
  expectRoute(page, 'fixtures');
  page.changeHash('');
  expectRoute(page, 'overview');
  page.changeHash('#news');
  expectRoute(page, 'news');
  assert.equal(page.replacements(), 2, 'Only invalid hashes need canonicalization');
});

test('every data-view, data-view-link and data-jump control selects its target', async () => {
  const page = await openPage('#standings');
  for (const el of page.queryAll('[data-view], [data-view-link], [data-jump]')) {
    el.click();
    expectRoute(page, el.dataset.view ?? el.dataset.viewLink ?? el.dataset.jump);
  }
});
