// Qimen Dunjia HTTP API Server v3.1 for myfengshui.today
// Engine: qimen-dunjia (npm) v2.1.0 — 拆补法
// Array index mapping: 0=巽SE(4), 1=离S(9), 2=坤SW(2), 3=震E(3), 4=中C(5), 5=兑W(7), 6=艮NE(8), 7=坎N(1), 8=乾NW(6)
const express = require('express');
const cors = require('cors');
const { generateChartByDatetime, chartToObject } = require('qimen-dunjia');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Array index → Palace number (Luo Shu)
// Index:  0    1    2    3    4    5    6    7    8
// Palace: 4    9    2    3    5    7    8    1    6
// Dir:    SE   S    SW   E    C    W    NE   N    NW
const IDX_TO_PALACE = [4, 9, 2, 3, 5, 7, 8, 1, 6];

const PALACE_INFO = {
  1:{en:'N', cn:'正北', trigram:'坎', element:'水'},
  2:{en:'SW',cn:'西南', trigram:'坤', element:'土'},
  3:{en:'E', cn:'正东', trigram:'震', element:'木'},
  4:{en:'SE',cn:'东南', trigram:'巽', element:'木'},
  5:{en:'C', cn:'中宫', trigram:'中', element:'土'},
  6:{en:'NW',cn:'西北', trigram:'乾', element:'金'},
  7:{en:'W', cn:'正西', trigram:'兑', element:'金'},
  8:{en:'NE',cn:'东北', trigram:'艮', element:'土'},
  9:{en:'S', cn:'正南', trigram:'离', element:'火'}
};

const DOOR_TYPE = {
  '休門':'ji','生門':'ji','景門':'ji','開門':'ji',
  '傷門':'xiong','杜門':'xiong','死門':'xiong','驚門':'xiong',
  // simplified chars
  '休门':'ji','生门':'ji','景门':'ji','开门':'ji',
  '伤门':'xiong','杜门':'xiong','死门':'xiong','惊门':'xiong'
};

function formatDatetime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  const h = String(date.getHours()).padStart(2,'0');
  return `${y}${m}${d}${h}`;
}

function buildChart(date, chartType) {
  const dt = chartType === 'day'
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
    : date;

  const obj = chartToObject(generateChartByDatetime(formatDatetime(dt)));

  const diPan   = obj['地盤'] || [];   // array[9], index 0-8
  const tianPan = obj['天盤'] || [];
  const baMen   = obj['天門'] || [];
  const jiuXing = obj['九星'] || [];
  const baShen  = obj['八神'] || [];
  const zhiFuXing = obj['值符'] || '';
  const zhiShiMen = obj['值使'] || '';
  const zhiFuPos  = obj['值符落宮']; // palace number 0-8 index
  const zhiShiPos = obj['值使落宮'];

  // Build palaces using correct index→palace mapping
  const palaces = {};
  for (let idx = 0; idx < 9; idx++) {
    const palNum = IDX_TO_PALACE[idx];
    const door   = baMen[idx]   || '';
    const star   = jiuXing[idx] || '';
    const god    = baShen[idx]  || '';
    const earth  = diPan[idx]   || '';
    const heaven = tianPan[idx] || '';
    const doorType = DOOR_TYPE[door] || 'ping';
    const isZhiFu = (zhiFuPos !== undefined) ? idx === zhiFuPos : star === zhiFuXing;
    const isZhiShi= (zhiShiPos !== undefined) ? idx === zhiShiPos : door === zhiShiMen;

    palaces[palNum] = {
      palace: palNum,
      idx,
      direction: PALACE_INFO[palNum],
      star,
      door: door.replace('門','').replace('门',''),
      god,
      earthStem: earth,
      heavenStem: heaven,
      isEmpty: false,
      isZhiFu,
      isZhiShi,
      jiXiong: doorType
    };
  }

  const isYang = obj['陰陽'] === '陽';
  const juNum  = parseInt(obj['局數'] || '1');
  const yearGZ = obj['年柱'] || '';
  const monthGZ= obj['月柱'] || '';
  const dayGZ  = obj['日柱'] || '';
  const hourGZ = obj['時柱'] || '';

  return {
    chartType,
    isYangDun: isYang,
    juNumber: juNum,
    juName: `${isYang?'阳':'阴'}遁${juNum}局`,
    jieQi: obj['節氣'] || '',
    yuan: obj['三元'] || '',
    dayGan: dayGZ[0]||'', dayZhi: dayGZ[1]||'', dayGanZhi: dayGZ,
    monthGan: monthGZ[0]||'', monthZhi: monthGZ[1]||'',
    yearGan: yearGZ[0]||'', yearZhi: yearGZ[1]||'',
    hourGan: hourGZ[0]||null, hourZhi: hourGZ[1]||null, hourGanZhi: hourGZ||null,
    zhiFuStar: zhiFuXing,
    zhiShiDoor: zhiShiMen,
    xunShou: obj['旬首']||'',
    fuShou: obj['符首']||'',
    palaces
  };
}

app.get('/health', (req, res) => res.json({ status:'ok', engine:'qimen-dunjia v2.1.0', version:'3.1' }));

// Debug — raw output
app.get('/debug', (req, res) => {
  try {
    const now = new Date();
    const obj = chartToObject(generateChartByDatetime(formatDatetime(now)));
    res.json(obj);
  } catch(e) { console.error('[qimen/debug] error:', e.message, e.stack); res.status(500).json({ error: e.message, stack:e.stack?.split('\n')[0] }); }
});

app.get('/qimen/both', (req, res) => {
  try {
    const now = new Date();
    res.json({ success:true, hour:buildChart(now,'hour'), day:buildChart(now,'day'), timestamp:now.toISOString() });
  } catch(e) { console.error('[qimen] error:', e.message, e.stack); res.status(500).json({ success:false, error:e.message, stack:e.stack?.split('\n')[0] }); }
});

app.post('/qimen/both', (req, res) => {
  try {
    const now = req.body.solarDatetime ? new Date(req.body.solarDatetime) : new Date();
    res.json({ success:true, hour:buildChart(now,'hour'), day:buildChart(now,'day'), timestamp:now.toISOString() });
  } catch(e) { console.error('[qimen] error:', e.message, e.stack); res.status(500).json({ success:false, error:e.message, stack:e.stack?.split('\n')[0] }); }
});

app.post('/qimen/hour', (req, res) => {
  try {
    const date = req.body.solarDatetime ? new Date(req.body.solarDatetime) : new Date();
    res.json({ success:true, data:buildChart(date,'hour') });
  } catch(e) { console.error('[qimen] error:', e.message, e.stack); res.status(500).json({ success:false, error:e.message, stack:e.stack?.split('\n')[0] }); }
});

app.post('/qimen/day', (req, res) => {
  try {
    const date = req.body.solarDatetime ? new Date(req.body.solarDatetime) : new Date();
    res.json({ success:true, data:buildChart(date,'day') });
  } catch(e) { console.error('[qimen] error:', e.message, e.stack); res.status(500).json({ success:false, error:e.message, stack:e.stack?.split('\n')[0] }); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Qimen MCP Server v3.1 (qimen-dunjia 拆补法 fixed mapping) on port ${PORT}`));
