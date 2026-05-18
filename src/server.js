// Qimen Dunjia HTTP API Server for myfengshui.today
// Uses qfdk/qimen verified calculation engine (茅山派)
const express = require('express');
const cors = require('cors');
const qimen = require('../lib/qimen');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PALACE_DIRS = {
  1:{en:'N',cn:'正北',trigram:'坎'},2:{en:'SW',cn:'西南',trigram:'坤'},3:{en:'E',cn:'正东',trigram:'震'},
  4:{en:'SE',cn:'东南',trigram:'巽'},5:{en:'C',cn:'中宫',trigram:'中'},6:{en:'NW',cn:'西北',trigram:'乾'},
  7:{en:'W',cn:'正西',trigram:'兑'},8:{en:'NE',cn:'东北',trigram:'艮'},9:{en:'S',cn:'正南',trigram:'离'}
};

function buildChart(date, chartType) {
  const method = chartType === 'day' ? '日家' : '时家';
  const pan = qimen.calculate(date, { type:'四柱', method, purpose:'综合', location:'默认位置' });
  if (pan.error) throw new Error(pan.message);

  // Build normalized palaces
  const palaces = {};
  for (let i = 1; i <= 9; i++) {
    const star  = pan.jiuXing?.[i] || '';
    const door  = pan.baMen?.[i]   || '';
    const god   = pan.baShen?.[i]  || '';
    const earth = pan.diPan?.[i]   || '';
    const heaven= pan.tianPan?.[i] || '';
    const kong  = pan.kongWangGong || [];
    const analysis = pan.jiuGongAnalysis?.[i] || {};

    palaces[i] = {
      palace:    i,
      direction: PALACE_DIRS[i],
      star,
      door:      door.replace('门',''),
      god,
      earthStem: earth,
      heavenStem:heaven,
      isEmpty:   Array.isArray(kong) ? kong.includes(i) : kong == i,
      isZhiFu:   pan.zhiFuGong == i,
      isZhiShi:  pan.zhiShiGong == i,
      jiXiong:   analysis.jiXiong || 'ping'
    };
  }

  // Extract GanZhi from siZhu
  const siZhu = pan.siZhu || {};
  const yearGZ  = siZhu.year  || '';
  const monthGZ = siZhu.month || '';
  const dayGZ   = siZhu.day   || '';
  const hourGZ  = siZhu.time  || '';

  const juShu = pan.juShu || {};

  return {
    chartType,
    isYangDun:   juShu.type === 'yang',
    juNumber:    parseInt(juShu.number) || 1,
    juName:      `${juShu.type==='yang'?'阳':'阴'}遁${juShu.number}局`,
    jieQi:       juShu.jieQiName || '',
    dayGan:      dayGZ[0]   || '',
    dayZhi:      dayGZ[1]   || '',
    dayGanZhi:   dayGZ,
    monthGan:    monthGZ[0] || '',
    monthZhi:    monthGZ[1] || '',
    yearGan:     yearGZ[0]  || '',
    yearZhi:     yearGZ[1]  || '',
    hourGan:     hourGZ[0]  || null,
    hourZhi:     hourGZ[1]  || null,
    hourGanZhi:  hourGZ     || null,
    zhiFuStar:   pan.zhiFuXing  || '',
    zhiShiDoor:  pan.zhiShiMen || '',
    xunShou:     pan.xunShou   || '',
    kongWang:    pan.kongWangZhi || [],
    palaces
  };
}

// ── ROUTES ──
app.get('/health', (req, res) => {
  res.json({ status:'ok', service:'qimen-mcp-server', engine:'qfdk/qimen茅山派', version:'2.0' });
});

app.post('/qimen/hour', (req, res) => {
  try {
    const date = req.body.solarDatetime ? new Date(req.body.solarDatetime) : new Date();
    res.json({ success:true, data: buildChart(date, 'hour') });
  } catch(e) {
    console.error('[hour]', e.message);
    res.status(500).json({ success:false, error:e.message });
  }
});

app.post('/qimen/day', (req, res) => {
  try {
    const d = req.body.solarDatetime ? new Date(req.body.solarDatetime) : new Date();
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    res.json({ success:true, data: buildChart(date, 'day') });
  } catch(e) {
    console.error('[day]', e.message);
    res.status(500).json({ success:false, error:e.message });
  }
});

app.get('/qimen/both', (req, res) => {
  try {
    const now = new Date();
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    res.json({ success:true, hour: buildChart(now,'hour'), day: buildChart(dayDate,'day'), timestamp: now.toISOString() });
  } catch(e) {
    console.error('[both]', e.message);
    res.status(500).json({ success:false, error:e.message });
  }
});

app.post('/qimen/both', (req, res) => {
  try {
    const now = req.body.solarDatetime ? new Date(req.body.solarDatetime) : new Date();
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    res.json({ success:true, hour: buildChart(now,'hour'), day: buildChart(dayDate,'day'), timestamp: now.toISOString() });
  } catch(e) {
    console.error('[both]', e.message);
    res.status(500).json({ success:false, error:e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Qimen MCP Server v2.0 (qfdk茅山派) on port ${PORT}`));
