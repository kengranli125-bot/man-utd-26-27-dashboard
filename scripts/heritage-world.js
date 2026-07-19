const sceneArt = (kind) => `./assets/scroll-world/${kind}.webp`;

mountScrollWorld(document.getElementById('heritageWorld'), {
  brand: { name: 'UNITED HERITAGE', href: '#top' },
  cta: { label: '进入实时看板', href: '#dashboard' },
  hint: '向下滚动 · 穿越红魔世界',
  diveScroll: 1.55,
  crossfade: 0.2,
  sections: [
    {
      id: 'stadium', label: '梦剧场', still: sceneArt('stadium'), stillMobile: sceneArt('stadium-mobile'),
      accent: '#da291c', scroll: 1.9, linger: 0.35,
      eyebrow: 'THE THEATRE OF DREAMS', title: '一切，从梦剧场开始。',
      body: '沿着灯光穿越老特拉福德，从草坪、看台与球员通道走进红魔的百年记忆。',
      tags: ['老特拉福德', '1910 至今', '红色主场']
    },
    {
      id: 'trophies', label: '冠军殿堂', still: sceneArt('trophies'), stillMobile: sceneArt('trophies-mobile'),
      accent: '#fbe122', scroll: 1.65, linger: 0.42,
      eyebrow: 'GLORY · GLORY', title: '奖杯，记录伟大时代。',
      body: '联赛、欧洲与杯赛荣耀在金色光束中汇聚，每一座奖杯都是一段不朽征程。',
      tags: ['英格兰冠军', '欧洲之巅', '三冠王记忆']
    },
    {
      id: 'kits', label: '红色战袍', still: sceneArt('kits'), stillMobile: sceneArt('kits-mobile'),
      accent: '#f5f1e8', scroll: 1.55, linger: 0.38,
      eyebrow: 'WORN WITH PRIDE', title: '一件球衣，一种身份。',
      body: '从经典衣领到现代剪裁，红色战袍把不同年代的球员与球迷连成同一支队伍。',
      tags: ['经典红', '历代设计', '球迷文化']
    },
    {
      id: 'crest', label: '红魔印记', still: sceneArt('crest'), stillMobile: sceneArt('crest-mobile'),
      accent: '#da291c', scroll: 1.55, linger: 0.48,
      eyebrow: 'THE RED DEVIL', title: '队徽，是永不熄灭的印记。',
      body: '船、盾牌、足球与红魔意象，凝结曼彻斯特的工业血脉与俱乐部的进攻精神。',
      tags: ['曼彻斯特', '红魔精神', '全球信仰']
    },
    {
      id: 'players', label: '红魔一线队', still: sceneArt('players'), stillMobile: sceneArt('players-mobile'),
      accent: '#fbe122', scroll: 2.05, linger: 0.5,
      eyebrow: 'THE CURRENT REDS', title: '新一代，接过红色战袍。',
      body: '布鲁诺、库尼亚、阿马德、梅努、约罗与谢什科组成新的红魔核心，继续书写 26/27 赛季。',
      tags: ['真实球员', '当前一线队', '26/27 阵容'],
      cta: {
        primary: { label: '进入 26/27 实时看板', href: '#dashboard' },
        secondary: { label: '回到梦剧场', href: '#top' }
      }
    }
  ],
  connectors: []
});
