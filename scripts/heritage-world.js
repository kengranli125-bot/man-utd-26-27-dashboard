const sceneArt = (kind) => `./assets/scroll-world/${kind}.webp`;

mountScrollWorld(document.getElementById('heritageWorld'), {
  brand: { name: 'UNITED HERITAGE', href: '#top' },
  cta: { label: '进入实时看板', href: '#dashboard' },
  nav: false,
  hint: '向下探索',
  diveScroll: 1.55,
  crossfade: 0.2,
  sections: [
    {
      id: 'stadium', label: '梦剧场', still: sceneArt('stadium'), stillMobile: sceneArt('stadium-mobile'),
      accent: '#da291c', scroll: 1.9, linger: 0.35,
      eyebrow: 'OLD TRAFFORD', title: '梦剧场。',
      body: '老特拉福德，红魔故事开始的地方。'
    },
    {
      id: 'trophies', label: '冠军殿堂', still: sceneArt('trophies'), stillMobile: sceneArt('trophies-mobile'),
      accent: '#fbe122', scroll: 1.65, linger: 0.42,
      eyebrow: 'GLORY · GLORY', title: '为荣耀而生。',
      body: '每一座奖杯，都是一代红魔留下的坐标。'
    },
    {
      id: 'kits', label: '红色战袍', still: sceneArt('kits'), stillMobile: sceneArt('kits-mobile'),
      accent: '#f5f1e8', scroll: 1.55, linger: 0.38,
      eyebrow: 'WORN WITH PRIDE', title: '身披红色。',
      body: '一件球衣，一种共同身份。'
    },
    {
      id: 'crest', label: '红魔印记', still: sceneArt('crest'), stillMobile: sceneArt('crest-mobile'),
      accent: '#da291c', scroll: 1.55, linger: 0.48,
      eyebrow: 'THE RED DEVIL', title: '红魔印记。',
      body: '来自曼彻斯特，属于全世界。'
    },
    {
      id: 'players', label: '红魔一线队', still: sceneArt('players'), stillMobile: sceneArt('players-mobile'),
      accent: '#fbe122', scroll: 2.05, linger: 0.5,
      eyebrow: 'THE CURRENT REDS', title: '新的篇章。',
      body: '新一代红魔，继续书写 26/27 赛季。',
      cta: {
        primary: { label: '进入 26/27 实时看板', href: '#dashboard' },
        secondary: { label: '重新浏览', href: '#top' }
      }
    }
  ],
  connectors: []
});
