// Qimen Dunjia HTTP API Server for myfengshui.today
// Uses lunar-typescript for Chinese calendar + implements Qimen formulas
const express = require('express');
const cors = require('cors');
const { Lunar, Solar } = require('lunar-typescript');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── QIMEN CONSTANTS ──
const NINE_STARS = ['天蓬','天芮','天冲','天辅','天禽','天心','天柱','天任','天英'];
const EIGHT_DOORS = ['休','生','伤','杜','景','死','惊','开'];
const EIGHT_GODS = ['值符','腾蛇','太阴','六合','白虎','玄武','九地','九天'];
const THREE_QI_SIX_Yi = ['乙','丙','丁','戊','己','庚','辛','壬','癸'];
const TEN_STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const TWELVE_BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// Luo Shu palace order (1-9 mapped to directions)
// Palace positions: 1=N, 2=SW, 3=E, 4=SE, 5=C, 6=NW, 7=W, 8=NE, 9=S
const PALACE_DIRECTIONS = {
  1: { cn: '坎', en: 'N', trigram: '坎', element: '水', number: 1 },
  2: { cn: '坤', en: 'SW', trigram: '坤', element: '土', number: 2 },
  3: { cn: '震', en: 'E', trigram: '震', element: '木', number: 3 },
  4: { cn: '巽', en: 'SE', trigram: '巽', element: '木', number: 4 },
  5: { cn: '中', en: 'C', trigram: '中', element: '土', number: 5 },
  6: { cn: '乾', en: 'NW', trigram: '乾', element: '金', number: 6 },
  7: { cn: '兑', en: 'W', trigram: '兑', element: '金', number: 7 },
  8: { cn: '艮', en: 'NE', trigram: '艮', element: '土', number: 8 },
  9: { cn: '离', en: 'S', trigram: '离', element: '火', number: 9 }
};

// Yang Dun: stars ascend 1→2→3... Yin Dun: descend 9→8→7...
function getStarInPalace(juNumber, isYangDun, palaceNum) {
  // In Yang Dun: star = (palace + juNumber - 2) % 9 + 1
  // In Yin Dun: star descends
  let starIdx;
  if (isYangDun) {
    starIdx = ((palaceNum - 1 + juNumber - 1) % 9);
  } else {
    starIdx = ((palaceNum - 1 - (juNumber - 1) + 90) % 9);
  }
  return NINE_STARS[starIdx];
}

// Get earth plate stem for palace (地盘干)
function getEarthStem(juNumber, isYangDun, palaceNum) {
  // 甲 always hides; stems are 乙丙丁戊己庚辛壬癸 in 8 palaces + center
  const stems = isYangDun
    ? ['戊','己','庚','辛','壬','癸','乙','丙','丁']  // Yang starts with 戊 in palace of juNumber
    : ['戊','己','庚','辛','壬','癸','乙','丙','丁'];  // Yin reverses
  
  let offset;
  if (isYangDun) {
    offset = ((palaceNum - juNumber + 9) % 9);
  } else {
    offset = ((juNumber - palaceNum + 9) % 9);
  }
  return stems[offset];
}

// Determine Yang/Yin Dun from solar term (节气)
function isYangDunFromJieQi(jieQi) {
  const yangTerms = ['冬至','小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种'];
  return yangTerms.includes(jieQi);
}

// Get 局数 (ju number 1-9) - simplified置闰法
function getJuNumber(jieQi, dayGanZhi, isYang) {
  // Yuan (元): each jieqi has 上中下 3 yuan, each 5 days
  // For simplicity, use day stem to determine yuan
  const stems60 = ['甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉',
                    '甲戌','乙亥','丙子','丁丑','戊寅','己卯','庚辰','辛巳','壬午','癸未',
                    '甲申','乙酉','丙戌','丁亥','戊子','己丑','庚寅','辛卯','壬辰','癸巳',
                    '甲午','乙未','丙申','丁酉','戊戌','己亥','庚子','辛丑','壬寅','癸卯',
                    '甲辰','乙巳','丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑',
                    '甲寅','乙卯','丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥'];
  
  const idx = stems60.indexOf(dayGanZhi);
  const pos = idx >= 0 ? idx % 15 : 0; // position within 上中下 yuan
  
  // Ju number lookup table by jieqi and yuan
  const juTable = {
    '冬至': [1,7,4], '小寒': [2,8,5], '大寒': [3,9,6],
    '立春': [8,5,2], '雨水': [7,4,1], '惊蛰': [6,3,9],
    '春分': [3,9,6], '清明': [2,8,5], '谷雨': [1,7,4],
    '立夏': [4,1,7], '小满': [5,2,8], '芒种': [6,3,9],
    '夏至': [9,3,6], '小暑': [8,2,5], '大暑': [7,1,4],
    '立秋': [2,5,8], '处暑': [3,6,9], '白露': [4,7,1],
    '秋分': [7,1,4], '寒露': [8,2,5], '霜降': [9,3,6],
    '立冬': [6,9,3], '小雪': [5,8,2], '大雪': [4,7,1]
  };
  
  const yuanIdx = Math.floor(pos / 5); // 0=上, 1=中, 2=下
  const table = juTable[jieQi] || [1,5,9];
  return table[Math.min(yuanIdx, 2)];
}

// Get hour stem (时干) from day stem and hour branch
function getHourStem(dayStemIdx, hourBranchIdx) {
  // 五虎遁年起月法 adapted for hours
  // Day stems 甲己 → hour 子 starts 甲
  const startStemByDay = [0,2,4,6,8,0,2,4,6,8]; // 甲乙丙丁戊己庚辛壬癸
  const startStem = startStemByDay[dayStemIdx];
  return (startStem + hourBranchIdx) % 10;
}

// Build full 9-palace Qimen chart
function buildQimenChart(lunar, chartType) {
  const jieQi = lunar.getPrevJieQi()?.getName() || lunar.getJieQi() || '冬至';
  const dayGanZhi = lunar.getDayInGanZhi();
  const dayGan = lunar.getDayGan();
  const dayZhi = lunar.getDayZhi();
  const monthGan = lunar.getMonthGan();
  const monthZhi = lunar.getMonthZhi();
  const yearGan = lunar.getYearGan();
  const yearZhi = lunar.getYearZhi();
  
  const isYang = isYangDunFromJieQi(jieQi);
  const juNumber = getJuNumber(jieQi, dayGanZhi, isYang);
  
  let hourGan = '', hourZhi = '', hourGanZhi = '';
  if (chartType === 'hour') {
    const solar = lunar.getSolar();
    const h = solar.getHour();
    const branchIdx = Math.floor((h + 1) / 2) % 12;
    hourZhi = TWELVE_BRANCHES[branchIdx];
    const dayGanIdx = TEN_STEMS.indexOf(dayGan);
    const hourStemIdx = getHourStem(dayGanIdx, branchIdx);
    hourGan = TEN_STEMS[hourStemIdx];
    hourGanZhi = hourGan + hourZhi;
  }

  // Value symbol star (值符) - always follows hour stem (or day stem for day chart)
  // 甲戊庚 → 天辅 (palace 4 in Yang Dun 1)
  // Simplified: value star starts at palace of juNumber
  const zhiFuPalace = juNumber; // 值符 is at the palace of the ju number
  const zhiShiDoor = EIGHT_DOORS[(juNumber - 1) % 8]; // 值使 door

  // Build each palace
  const palaces = {};
  for (let p = 1; p <= 9; p++) {
    const star = getStarInPalace(juNumber, isYang, p);
    const earthStem = getEarthStem(juNumber, isYang, p);
    
    // Heaven plate: shifted by hour/day stem
    const refStem = chartType === 'hour' ? hourGan : dayGan;
    const refStemIdx = TEN_STEMS.indexOf(refStem);
    const heavenOffset = isYang ? refStemIdx % 9 : (9 - refStemIdx % 9) % 9;
    const heavenStemIdx = ((TEN_STEMS.indexOf(earthStem) + heavenOffset) % 9);
    const heavenStem = THREE_QI_SIX_Yi[heavenStemIdx] || earthStem;

    // Door assignment: 值使门 at palace of juNumber, others rotate
    const doorOffset = isYang
      ? (p - juNumber + 8) % 8
      : (juNumber - p + 8) % 8;
    const zuShiIdx = EIGHT_DOORS.indexOf(zhiShiDoor);
    const doorIdx = (zuShiIdx + doorOffset) % 8;
    const door = p === 5 ? '—' : EIGHT_DOORS[doorIdx]; // center has no door

    // God assignment: 值符 at zhiFuPalace, others rotate
    const godOffset = isYang
      ? (p - zhiFuPalace + 8) % 8
      : (zhiFuPalace - p + 8) % 8;
    const god = EIGHT_GODS[godOffset % 8];

    // Emptiness check (空亡)
    const dayIdx = stems60Index(dayGanZhi);
    const xunStart = Math.floor(dayIdx / 10) * 10;
    const emptyBranches = [TWELVE_BRANCHES[(xunStart + 10) % 12], TWELVE_BRANCHES[(xunStart + 11) % 12]];
    const isEmpty = emptyBranches.some(b => earthStem.includes(b));

    palaces[p] = {
      palace: p,
      direction: PALACE_DIRECTIONS[p],
      star,
      door,
      god,
      earthStem,
      heavenStem,
      isEmpty,
      isZhiFu: p === zhiFuPalace,
      isZhiShi: p === juNumber
    };
  }

  return {
    chartType,
    isYangDun: isYang,
    juNumber,
    juName: `${isYang ? '阳' : '阴'}遁${juNumber}局`,
    jieQi,
    dayGan,
    dayZhi,
    dayGanZhi,
    monthGan,
    monthZhi,
    yearGan,
    yearZhi,
    hourGan: hourGan || null,
    hourZhi: hourZhi || null,
    hourGanZhi: hourGanZhi || null,
    zhiFuStar: NINE_STARS[juNumber - 1],
    zhiShiDoor,
    palaces
  };
}

function stems60Index(ganZhi) {
  const stems60 = ['甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉',
    '甲戌','乙亥','丙子','丁丑','戊寅','己卯','庚辰','辛巳','壬午','癸未',
    '甲申','乙酉','丙戌','丁亥','戊子','己丑','庚寅','辛卯','壬辰','癸巳',
    '甲午','乙未','丙申','丁酉','戊戌','己亥','庚子','辛丑','壬寅','癸卯',
    '甲辰','乙巳','丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑',
    '甲寅','乙卯','丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥'];
  return stems60.indexOf(ganZhi);
}

// ── ROUTES ──

// GET /health
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'qimen-mcp-server', version: '1.0' }));

// POST /qimen/hour — Current Hour Chart (时家奇门)
app.post('/qimen/hour', (req, res) => {
  try {
    const { solarDatetime } = req.body;
    let solar;
    if (solarDatetime) {
      const d = new Date(solarDatetime);
      solar = Solar.fromYmdHms(d.getFullYear(), d.getMonth()+1, d.getDate(), d.getHours(), d.getMinutes(), 0);
    } else {
      const now = new Date();
      solar = Solar.fromYmdHms(now.getFullYear(), now.getMonth()+1, now.getDate(), now.getHours(), now.getMinutes(), 0);
    }
    const lunar = solar.getLunar();
    const chart = buildQimenChart(lunar, 'hour');
    res.json({ success: true, data: chart });
  } catch (e) {
    console.error('[qimen/hour] error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /qimen/day — Current Day Chart (日家奇门)
app.post('/qimen/day', (req, res) => {
  try {
    const { solarDatetime } = req.body;
    let solar;
    if (solarDatetime) {
      const d = new Date(solarDatetime);
      solar = Solar.fromYmdHms(d.getFullYear(), d.getMonth()+1, d.getDate(), 12, 0, 0);
    } else {
      const now = new Date();
      solar = Solar.fromYmdHms(now.getFullYear(), now.getMonth()+1, now.getDate(), 12, 0, 0);
    }
    const lunar = solar.getLunar();
    const chart = buildQimenChart(lunar, 'day');
    res.json({ success: true, data: chart });
  } catch (e) {
    console.error('[qimen/day] error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /qimen/both — Both hour and day charts
app.post('/qimen/both', (req, res) => {
  try {
    const { solarDatetime } = req.body;
    const now = solarDatetime ? new Date(solarDatetime) : new Date();
    
    const solarHour = Solar.fromYmdHms(now.getFullYear(), now.getMonth()+1, now.getDate(), now.getHours(), now.getMinutes(), 0);
    const solarDay  = Solar.fromYmdHms(now.getFullYear(), now.getMonth()+1, now.getDate(), 12, 0, 0);
    
    const hourChart = buildQimenChart(solarHour.getLunar(), 'hour');
    const dayChart  = buildQimenChart(solarDay.getLunar(), 'day');
    
    res.json({ success: true, hour: hourChart, day: dayChart, timestamp: now.toISOString() });
  } catch (e) {
    console.error('[qimen/both] error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Qimen MCP Server running on port ${PORT}`));
