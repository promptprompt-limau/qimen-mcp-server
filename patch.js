// postinstall patch — fixes qimen-dunjia missing solar term mappings
const fs = require('fs');
const path = require('path');

const calcPath = path.join(__dirname, 'node_modules', 'qimen-dunjia', 'calculations.js');

try {
  let c = fs.readFileSync(calcPath, 'utf8');
  if (c.includes("'芒种': '芒種'")) {
    console.log('[patch] already patched');
    process.exit(0);
  }
  c = c.replace(
    "'处暑': '處暑'",
    `'处暑': '處暑',
    '芒种': '芒種',
    '小满': '小滿',
    '大暑': '大暑',
    '小暑': '小暑',
    '白露': '白露',
    '霜降': '霜降',
    '雨水': '雨水',
    '大雪': '大雪',
    '小雪': '小雪',
    '立春': '立春',
    '立夏': '立夏',
    '立秋': '立秋',
    '立冬': '立冬',
    '寒露': '寒露',
    '冬至': '冬至',
    '夏至': '夏至',
    '春分': '春分',
    '秋分': '秋分',
    '清明': '清明',
    '小寒': '小寒',
    '大寒': '大寒'`
  );
  fs.writeFileSync(calcPath, c, 'utf8');
  console.log('[patch] ✓ solar term mappings fixed');
} catch(e) {
  console.warn('[patch] failed:', e.message);
}
