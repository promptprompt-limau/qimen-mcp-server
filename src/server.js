// Qimen Dunjia HTTP API Server v3.0 for myfengshui.today
// Engine: qimen-dunjia (npm) — 拆补法, lunar-javascript, 21 unit tests, v2.1.0 Jan 2026
const express = require('express');
const cors = require('cors');
const { generateChartByDatetime, generateChartNow, chartToObject } = require('qimen-dunjia');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PALACE_DIRS = {
  1:{en:'N',cn:'正北',trigram:'坎',element:'水'},
  2:{en:'SW',cn:'西南',trigram:'坤',element:'土'},
  3:{en:'E',cn:'正东',trigram:'震',element:'木'},
  4:{en:'SE',cn:'东南',trigram:'巽',element:'木'},
  5:{en:'C',cn:'中宫',trigram:'中',element:'土'},
  6:{en:'NW',cn:'西北',trigram:'乾',element:'金'},
  7:{en:'W',cn:'正西',trigram:'兑',element:'金'},
  8:{en:'NE',cn:'东北',trigram:'艮',element:'土'},
  9:{en:'S',cn:'正南',trigram:'离',element:'火'}
};

// Door auspiciousness
const DOOR_JI = {'休':'ji','生':'ji','景':'ji','開':'ji','开':'ji','Rest':'ji','Life':'ji','Scenery':'ji','Open':'ji'};
const DOOR_XIONG = {'傷':'xiong','杜':'xiong','死':'xiong','驚':'xiong','伤':'xiong','惊':'xiong'};

function formatDatetime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  const h = String(date.getHours()).padStart(2,'0');
  return `${y}${m}${d}${h}`;
}

function buildChart(date, chartType) {
  // For day chart, use noon
  const dt = chartType === 'day'
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
    : date;

  const dtStr = formatDatetime(dt);
  const chart = generateChartByDatetime(dtStr);
  const obj = chartToObject(chart);

  // Extract palace data
  // obj['地盤'] = array of 9 stems indexed by palace (1-9 in Luo Shu order)
  // obj['天盤'] = array of 9 stems
  // obj['八門'] = array of 9 doors
  // obj['九星'] = array of 9 stars
  // obj['八神'] = array of 9 gods
  // obj['空亡'] = kong wang info
  // obj['值符'] = zhi fu star
  // obj['值使'] = zhi shi door

  const diPan   = obj['地盤']  || [];
  const tianPan = obj['天盤']  || [];
  const baMen   = obj['天門']  || obj['八門'] || [];
  const jiuXing = obj['九星']  || [];
  const baShen  = obj['八神']  || [];
  const kongWang= obj['空亡']  || {};
  const zhiFuXing = obj['值符'] || '';
  const zhiShiMen = obj['值使'] || '';

  // Build palaces — arrays are indexed 0-8, palace numbers follow Luo Shu
  // Luo Shu order: palace 1=index0(坎N), 2=index1(坤SW)... etc
  // qimen-dunjia stores arrays in palace order 1-9
  const palaces = {};
  for (let i = 1; i <= 9; i++) {
    const idx = i - 1;
    const door = baMen[idx] || '';
    const doorType = DOOR_JI[door] ? 'ji' : (DOOR_XIONG[door] ? 'xiong' : 'ping');
    const star = jiuXing[idx] || '';
    const god = baShen[idx] || '';
    const earth = diPan[idx] || '';
    const heaven = tianPan[idx] || '';
    const isEmpty = kongWang && (kongWang[i] || false);
    const isZhiFu = star === zhiFuXing || star.includes(zhiFuXing);
    const isZhiShi = door === zhiShiMen || door.includes(zhiShiMen);

    palaces[i] = {
      palace: i,
      direction: PALACE_DIRS[i],
      star,
      door: door.replace('門','').replace('门',''),
      god,
      earthStem: earth,
      heavenStem: heaven,
      isEmpty,
      isZhiFu,
      isZhiShi,
      jiXiong: doorType
    };
  }

  // Extract GanZhi
  const yearGZ  = obj['年柱'] || '';
  const monthGZ = obj['月柱'] || '';
  const dayGZ   = obj['日柱'] || '';
  const hourGZ  = obj['時柱'] || obj['时柱'] || '';
  const isYang  = obj['陰陽'] === '陽' || obj['阴阳'] === '阳';
  const juNum   = parseInt(obj['局數'] || obj['局数'] || '1');
  const jieQi   = obj['節氣'] || obj['节气'] || '';
  const yuan    = obj['三元'] || '';

  return {
    chartType,
    isYangDun: isYang,
    juNumber: juNum,
    juName: `${isYang ? '阳' : '阴'}遁${juNum}局`,
    jieQi,
    yuan,
    dayGan: dayGZ[0] || '',
    dayZhi: dayGZ[1] || '',
    dayGanZhi: dayGZ,
    monthGan: monthGZ[0] || '',
    monthZhi: monthGZ[1] || '',
    yearGan: yearGZ[0] || '',
    yearZhi: yearGZ[1] || '',
    hourGan: hourGZ[0] || null,
    hourZhi: hourGZ[1] || null,
    hourGanZhi: hourGZ || null,
    zhiFuStar: zhiFuXing,
    zhiShiDoor: zhiShiMen,
    xunShou: obj['旬首'] || '',
    fuShou: obj['符首'] || '',
    palaces,
    raw: obj
  };
}

// ── ROUTES ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'qimen-mcp-server', engine: 'qimen-dunjia v2.1.0 拆补法', version: '3.0' });
});

app.post('/qimen/hour', (req, res) => {
  try {
    const date = req.body.solarDatetime ? new Date(req.body.solarDatetime) : new Date();
    res.json({ success: true, data: buildChart(date, 'hour') });
  } catch(e) {
    console.error('[hour]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/qimen/day', (req, res) => {
  try {
    const date = req.body.solarDatetime ? new Date(req.body.solarDatetime) : new Date();
    res.json({ success: true, data: buildChart(date, 'day') });
  } catch(e) {
    console.error('[day]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/qimen/both', (req, res) => {
  try {
    const now = new Date();
    res.json({
      success: true,
      hour: buildChart(now, 'hour'),
      day: buildChart(now, 'day'),
      timestamp: now.toISOString()
    });
  } catch(e) {
    console.error('[both]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/qimen/both', (req, res) => {
  try {
    const now = req.body.solarDatetime ? new Date(req.body.solarDatetime) : new Date();
    res.json({
      success: true,
      hour: buildChart(now, 'hour'),
      day: buildChart(now, 'day'),
      timestamp: now.toISOString()
    });
  } catch(e) {
    console.error('[both]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Qimen MCP Server v3.0 (qimen-dunjia 拆补法) on port ${PORT}`));
