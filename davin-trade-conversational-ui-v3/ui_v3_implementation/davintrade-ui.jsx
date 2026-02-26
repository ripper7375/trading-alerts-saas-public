import { useState, useEffect, useRef, useCallback } from 'react';

const MASCOT_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='32' fill='%23111827'/%3E%3Cellipse cx='32' cy='36' rx='16' ry='14' fill='%23b87333'/%3E%3Cellipse cx='32' cy='34' rx='12' ry='10' fill='%23d4956a'/%3E%3Ccircle cx='22' cy='10' r='7' fill='%23b87333'/%3E%3Ccircle cx='42' cy='10' r='7' fill='%23b87333'/%3E%3Ccircle cx='22' cy='9' r='4' fill='%23111827'/%3E%3Ccircle cx='42' cy='9' r='4' fill='%23111827'/%3E%3Cellipse cx='26' cy='30' rx='4' ry='4.5' fill='%23111827'/%3E%3Cellipse cx='38' cy='30' rx='4' ry='4.5' fill='%23111827'/%3E%3Ccircle cx='27' cy='29' r='1.5' fill='%23f59e0b'/%3E%3Ccircle cx='39' cy='29' r='1.5' fill='%23f59e0b'/%3E%3Cellipse cx='32' cy='38' rx='5' ry='3' fill='%23c0845a'/%3E%3Ccircle cx='32' cy='37' r='2.5' fill='%23111827'/%3E%3Cpath d='M27 42 Q32 46 37 42' stroke='%23111827' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3Crect x='10' y='22' width='8' height='5' rx='2' fill='%23111827' opacity='.6'/%3E%3Crect x='46' y='22' width='8' height='5' rx='2' fill='%23111827' opacity='.6'/%3E%3C/svg%3E";

// ─── Config ──────────────────────────────────────────────────────────────────
const SYMBOLS = [
  'XAUUSD',
  'BTCUSD',
  'EURUSD',
  'USDJPY',
  'GBPUSD',
  'ETHUSD',
  'NASDAQ',
];
const TIMEFRAMES = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'];
const BASE_PRICES = {
  XAUUSD: 2651,
  BTCUSD: 87200,
  EURUSD: 1.0852,
  USDJPY: 150.22,
  GBPUSD: 1.2648,
  ETHUSD: 3205,
  NASDAQ: 19540,
};
const VOLATILITY = {
  XAUUSD: 7,
  BTCUSD: 650,
  EURUSD: 0.003,
  USDJPY: 0.38,
  GBPUSD: 0.004,
  ETHUSD: 52,
  NASDAQ: 75,
};

// ─── Data Helpers ─────────────────────────────────────────────────────────────
function genOHLC(n, base, vol) {
  let p = base;
  const dp = base < 10 ? 5 : base < 1000 ? 3 : 2;
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const open = p;
    const chg = (Math.random() - 0.485) * vol;
    const close = +(open + chg).toFixed(dp);
    const high = +(Math.max(open, close) + Math.random() * vol * 0.42).toFixed(
      dp
    );
    const low = +(Math.min(open, close) - Math.random() * vol * 0.42).toFixed(
      dp
    );
    p = close;
    return {
      open,
      high,
      low,
      close,
      time: new Date(now - (n - i) * 5 * 60000),
    };
  });
}

function calcEMA(closes, period) {
  if (closes.length < period) return closes.map(() => null);
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = new Array(period - 1).fill(null);
  result.push(ema);
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcKeltner(data) {
  const c = data.map((d) => d.close);
  const mid = calcEMA(c, 20);
  const trs = data.map((d, i) =>
    i === 0
      ? d.high - d.low
      : Math.max(
          d.high - d.low,
          Math.abs(d.high - data[i - 1].close),
          Math.abs(d.low - data[i - 1].close)
        )
  );
  const atr = trs.map((_, i) =>
    i < 9 ? null : trs.slice(i - 9, i + 1).reduce((a, b) => a + b, 0) / 10
  );
  return {
    mid,
    upper: mid.map((m, i) => (m && atr[i] ? m + 2 * atr[i] : null)),
    lower: mid.map((m, i) => (m && atr[i] ? m - 2 * atr[i] : null)),
  };
}

function calcTEMAlines(data) {
  const c = data.map((d) => d.close);
  const e1 = calcEMA(c, 9);
  const e2 = calcEMA(
    e1.map((v, i) => v ?? c[i]),
    9
  );
  const e3 = calcEMA(
    e2.map((v, i) => v ?? c[i]),
    9
  );
  return {
    tema: e1.map((v, i) =>
      v && e2[i] && e3[i] ? 3 * v - 3 * e2[i] + e3[i] : null
    ),
    hrma: calcEMA(c, 21),
    ema50: calcEMA(c, 50),
  };
}

function calcZigZag(data) {
  const pivots = [];
  let lastType = null;
  for (let i = 2; i < data.length - 2; i++) {
    const isHi =
      data[i].high > data[i - 1].high &&
      data[i].high > data[i - 2].high &&
      data[i].high > data[i + 1].high &&
      data[i].high > data[i + 2].high;
    const isLo =
      data[i].low < data[i - 1].low &&
      data[i].low < data[i - 2].low &&
      data[i].low < data[i + 1].low &&
      data[i].low < data[i + 2].low;
    if (isHi && lastType !== 'high') {
      pivots.push({ idx: i, price: data[i].high, type: 'high' });
      lastType = 'high';
    } else if (isLo && lastType !== 'low') {
      pivots.push({ idx: i, price: data[i].low, type: 'low' });
      lastType = 'low';
    }
  }
  return pivots;
}

function calcTrendlines(data) {
  const highs = [],
    lows = [];
  for (let i = 2; i < data.length - 2; i++) {
    if (
      data[i].high > data[i - 1].high &&
      data[i].high > data[i + 1].high &&
      data[i].high > data[i - 2].high &&
      data[i].high > data[i + 2].high
    )
      highs.push({ idx: i, price: data[i].high });
    if (
      data[i].low < data[i - 1].low &&
      data[i].low < data[i + 1].low &&
      data[i].low < data[i - 2].low &&
      data[i].low < data[i + 2].low
    )
      lows.push({ idx: i, price: data[i].low });
  }
  return {
    highs: highs.sort((a, b) => b.price - a.price).slice(0, 3),
    lows: lows.sort((a, b) => a.price - b.price).slice(0, 3),
  };
}

// ─── Overlay Factories ────────────────────────────────────────────────────────
const ovTrendline = (data) => {
  const { highs, lows } = calcTrendlines(data);
  const ovs = [];
  highs.forEach((r) =>
    ovs.push({ hline: r.price, color: '#ef5350', width: 1, dash: [4, 3] })
  );
  lows.forEach((s) =>
    ovs.push({ hline: s.price, color: '#26a69a', width: 1, dash: [4, 3] })
  );
  if (highs.length >= 2) {
    const [a, b] = [...highs].sort((x, y) => x.idx - y.idx).slice(0, 2);
    const sl = (b.price - a.price) / (b.idx - a.idx);
    ovs.push({
      points: data.map((_, i) =>
        i < a.idx ? null : a.price + sl * (i - a.idx)
      ),
      color: '#ef5350',
      width: 1.5,
    });
  }
  if (lows.length >= 2) {
    const [a, b] = [...lows].sort((x, y) => x.idx - y.idx).slice(0, 2);
    const sl = (b.price - a.price) / (b.idx - a.idx);
    ovs.push({
      points: data.map((_, i) =>
        i < a.idx ? null : a.price + sl * (i - a.idx)
      ),
      color: '#26a69a',
      width: 1.5,
    });
  }
  return ovs;
};

const ovKeltner = (data) => {
  const kc = calcKeltner(data);
  return [
    {
      points: kc.upper,
      points2: kc.lower,
      color: '#7c3aed',
      fill: true,
      width: 0,
    },
    { points: kc.upper, color: '#a78bfa', width: 1.2 },
    { points: kc.lower, color: '#a78bfa', width: 1.2 },
    { points: kc.mid, color: '#f59e0b', width: 1.8 },
  ];
};

const ovTEMA = (data) => {
  const { tema, hrma, ema50 } = calcTEMAlines(data);
  return [
    { points: tema, color: '#38bdf8', width: 1.8 },
    { points: hrma, color: '#f59e0b', width: 1.8 },
    { points: ema50, color: '#c084fc', width: 1.2, dash: [4, 2] },
  ];
};

const ovZigZag = (data) => {
  const pivots = calcZigZag(data);
  if (pivots.length < 2) return [];
  return [{ pivots, color: '#f59e0b', width: 2.2 }];
};

// ─── Flex Panel Indicator Calculations ───────────────────────────────────────
function calcSMMA(closes, period) {
  const result = new Array(closes.length).fill(null);
  // seed with SMA
  let sum = 0,
    start = -1;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period - 1) {
      if (start === -1) {
        result[i] = sum / period;
        start = i;
      } else {
        result[i] = (result[i - 1] * (period - 1) + closes[i]) / period;
      }
    }
  }
  return result;
}

function calcHeikinAshi(data) {
  return data.map((d, i) => {
    const haClose = (d.open + d.high + d.low + d.close) / 4;
    const haOpen =
      i === 0
        ? (d.open + d.close) / 2
        : (data[i - 1].open + data[i - 1].close) / 2; // prev HA midpoint (approx)
    const haHigh = Math.max(d.high, haOpen, haClose);
    const haLow = Math.min(d.low, haOpen, haClose);
    return {
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      time: d.time,
    };
  });
}

const ovEMASMMA = (data) => {
  const c = data.map((d) => d.close);
  return [
    { points: calcEMA(c, 9), color: '#38bdf8', width: 1.6 },
    { points: calcEMA(c, 21), color: '#f59e0b', width: 1.6 },
    { points: calcSMMA(c, 34), color: '#4ade80', width: 1.6, dash: [5, 2] },
    { points: calcSMMA(c, 89), color: '#f472b6', width: 1.2, dash: [3, 3] },
  ];
};

// ─── Flex Panel Options ───────────────────────────────────────────────────────
const FLEX_OPTIONS = [
  { key: 'blank', label: 'Blank', ovFn: () => [], haMode: false },
  { key: 'zigzag', label: 'ZigZag', ovFn: ovZigZag, haMode: false },
  { key: 'heikin', label: 'Heikin Ashi', ovFn: () => [], haMode: true },
  { key: 'emasmma', label: 'EMA & SMMA', ovFn: ovEMASMMA, haMode: false },
];

// ─── Canvas Renderer ──────────────────────────────────────────────────────────
function drawChart(canvas, data, overlays) {
  if (!canvas || !data.length) return;
  const container = canvas.parentElement;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (!w || !h) return;
  canvas.width = w * window.devicePixelRatio;
  canvas.height = h * window.devicePixelRatio;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, w, h);

  const pad = { top: 12, bottom: 16, left: 4, right: 64 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  let allP = data.flatMap((d) => [d.high, d.low]);
  overlays.forEach((ov) => {
    if (ov.points) allP.push(...ov.points.filter(Boolean));
    if (ov.points2) allP.push(...ov.points2.filter(Boolean));
    if (ov.pivots) allP.push(...ov.pivots.map((p) => p.price));
    if (ov.hline) allP.push(ov.hline);
  });
  const maxP = Math.max(...allP);
  const minP = Math.min(...allP);
  const rng = maxP - minP || maxP * 0.01;
  const buf = rng * 0.06;
  const mxP = maxP + buf,
    mnP = minP - buf,
    fullRng = mxP - mnP;

  const xs = (i) => pad.left + (i / (data.length - 1)) * cw;
  const ys = (p) => pad.top + (1 - (p - mnP) / fullRng) * ch;
  const cw2 = Math.max(1.5, (cw / data.length) * 0.58);

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * ch;
    const pr = mxP - (i / 4) * fullRng;
    ctx.strokeStyle = '#131929';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    const fmt =
      pr < 10 ? pr.toFixed(5) : pr < 1000 ? pr.toFixed(3) : pr.toFixed(2);
    ctx.fillStyle = '#3d4a6a';
    ctx.font = `${9 * Math.min(1, w / 300)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(fmt, w - pad.right + 4, y + 3);
  }

  data.forEach((d, i) => {
    const x = xs(i);
    const g = d.close >= d.open;
    ctx.strokeStyle = g ? '#26a69a' : '#ef5350';
    ctx.fillStyle = g ? '#26a69a' : '#ef5350';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, ys(d.high));
    ctx.lineTo(x, ys(d.low));
    ctx.stroke();
    const bTop = Math.min(ys(d.open), ys(d.close));
    const bH = Math.max(1, Math.abs(ys(d.open) - ys(d.close)));
    ctx.fillRect(x - cw2 / 2, bTop, cw2, bH);
  });

  overlays.forEach((ov) => {
    ctx.strokeStyle = ov.color;
    ctx.lineWidth = ov.width || 1.5;
    ctx.setLineDash(ov.dash || []);
    ctx.globalAlpha = ov.alpha ?? 1;

    if (ov.fill && ov.points && ov.points2) {
      ctx.fillStyle = ov.color + '22';
      ctx.beginPath();
      let f = true;
      ov.points.forEach((p, i) => {
        if (!p) return;
        f ? (ctx.moveTo(xs(i), ys(p)), (f = false)) : ctx.lineTo(xs(i), ys(p));
      });
      for (let i = ov.points2.length - 1; i >= 0; i--)
        if (ov.points2[i]) ctx.lineTo(xs(i), ys(ov.points2[i]));
      ctx.closePath();
      ctx.fill();
    }

    if (!ov.width || ov.width === 0) {
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      return;
    }

    ctx.beginPath();
    let started = false;

    if (ov.hline !== undefined) {
      ctx.moveTo(pad.left, ys(ov.hline));
      ctx.lineTo(w - pad.right, ys(ov.hline));
    } else if (ov.pivots) {
      ov.pivots.forEach((pt) => {
        const x = xs(pt.idx),
          y = ys(pt.price);
        started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), (started = true));
      });
    } else if (ov.points) {
      ov.points.forEach((p, i) => {
        if (p == null) {
          started = false;
          return;
        }
        const x = xs(i),
          y = ys(p);
        started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), (started = true));
      });
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  });
}

// ─── Chart Panel with AI Query Button ────────────────────────────────────────
function ChartPanel({
  label,
  indicatorKey,
  data,
  ovFn,
  onQueryAI,
  isQuerying,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!data.length) return;
    const overlays = ovFn(data);
    const draw = () => drawChart(canvasRef.current, data, overlays);
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [data, ovFn]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #1a2035',
        borderRadius: 6,
        overflow: 'hidden',
        background: '#0a0e1a',
        minHeight: 0,
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 10px',
          background: '#0d1220',
          borderBottom: '1px solid #1a2035',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#f59e0b',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.02em',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 9,
            color: '#22c55e',
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#22c55e',
              display: 'inline-block',
              animation: 'pulse 2s infinite',
            }}
          />
          LIVE
        </span>
      </div>
      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>
      {/* AI Query Button — bottom-left corner */}
      <button
        onClick={() => onQueryAI(indicatorKey)}
        disabled={isQuerying}
        title={`Query DavinTrade AI about ${indicatorKey}`}
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: isQuerying ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          opacity: isQuerying ? 0.6 : 1,
          transition: 'opacity 0.2s',
          zIndex: 10,
        }}
      >
        <div style={{ position: 'relative' }}>
          <img
            src={MASCOT_IMG}
            alt="DavinTrade AI"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `2px solid ${isQuerying ? '#f59e0b' : '#2a3a5a'}`,
              objectFit: 'cover',
              objectPosition: 'center top',
              background: '#0d1220',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: isQuerying ? '0 0 8px #f59e0b88' : '0 0 4px #00000088',
            }}
          />
          {isQuerying && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid #f59e0b',
                borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
        </div>
        <span
          style={{
            fontSize: 9,
            color: '#f59e0b',
            fontFamily: "'JetBrains Mono',monospace",
            fontWeight: 700,
            textShadow: '0 1px 3px #000',
            letterSpacing: '0.02em',
            background: 'rgba(0,0,0,0.6)',
            padding: '2px 5px',
            borderRadius: 3,
          }}
        >
          {isQuerying ? 'Analyzing...' : 'Ask AI'}
        </span>
      </button>
    </div>
  );
}

// ─── Flex Chart Panel (bottom-right, user-selectable indicator) ───────────────
function FlexChartPanel({ sym, tf, data, onQueryAI, isQuerying }) {
  const [selected, setSelected] = useState('blank');
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const opt = FLEX_OPTIONS.find((o) => o.key === selected) || FLEX_OPTIONS[0];

  useEffect(() => {
    if (!data.length) return;
    const renderData = opt.haMode ? calcHeikinAshi(data) : data;
    const overlays = opt.ovFn(data);
    const draw = () => drawChart(canvasRef.current, renderData, overlays);
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [data, selected]);

  const flexKey = `flex_${selected}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #1a2035',
        borderRadius: 6,
        overflow: 'hidden',
        background: '#0a0e1a',
        minHeight: 0,
        position: 'relative',
      }}
    >
      {/* Header with dropdown */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: '#0d1220',
          borderBottom: '1px solid #1a2035',
          flexShrink: 0,
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'nowrap',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#f59e0b',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {sym} {tf} ·
          </span>
          {/* Indicator selector dropdown */}
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={{
              background: '#111827',
              color: '#f59e0b',
              border: '1px solid #f59e0b44',
              borderRadius: 4,
              padding: '2px 22px 2px 7px',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "'JetBrains Mono',monospace",
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23f59e0b' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 5px center',
              minWidth: 110,
            }}
          >
            {FLEX_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {/* Indicator badge */}
          {selected !== 'blank' && (
            <span
              style={{
                fontSize: 8,
                color: '#4a5a80',
                fontFamily: "'JetBrains Mono',monospace",
                whiteSpace: 'nowrap',
              }}
            >
              {selected === 'heikin' && 'HA candles'}
              {selected === 'zigzag' && 'pivot swings'}
              {selected === 'emasmma' && 'EMA9 EMA21 SMMA34 SMMA89'}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 9,
            color: '#22c55e',
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#22c55e',
              display: 'inline-block',
              animation: 'pulse 2s infinite',
            }}
          />
          LIVE
        </span>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, position: 'relative' }}
      >
        {selected === 'blank' ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                position: 'absolute',
                inset: 0,
                opacity: 0.25,
              }}
            />
            <div
              style={{ zIndex: 2, textAlign: 'center', pointerEvents: 'none' }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>📊</div>
              <div
                style={{
                  fontSize: 11,
                  color: '#2a3a5a',
                  fontFamily: "'JetBrains Mono',monospace",
                  fontWeight: 700,
                }}
              >
                SELECT AN INDICATOR
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: '#1a2535',
                  fontFamily: "'JetBrains Mono',monospace",
                  marginTop: 4,
                }}
              >
                Use the dropdown above
              </div>
            </div>
          </div>
        ) : (
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        )}
      </div>

      {/* AI Query Button */}
      <button
        onClick={() => onQueryAI(flexKey)}
        disabled={isQuerying || selected === 'blank'}
        title="Query DavinTrade AI about this indicator"
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor:
            isQuerying || selected === 'blank' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          opacity: selected === 'blank' ? 0.3 : isQuerying ? 0.6 : 1,
          transition: 'opacity 0.2s',
          zIndex: 10,
        }}
      >
        <div style={{ position: 'relative' }}>
          <img
            src={MASCOT_IMG}
            alt="DavinTrade AI"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `2px solid ${isQuerying ? '#f59e0b' : '#2a3a5a'}`,
              objectFit: 'cover',
              objectPosition: 'center top',
              background: '#0d1220',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: isQuerying ? '0 0 8px #f59e0b88' : '0 0 4px #00000088',
            }}
          />
          {isQuerying && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid #f59e0b',
                borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
        </div>
        <span
          style={{
            fontSize: 9,
            color: '#f59e0b',
            fontFamily: "'JetBrains Mono',monospace",
            fontWeight: 700,
            textShadow: '0 1px 3px #000',
            letterSpacing: '0.02em',
            background: 'rgba(0,0,0,0.6)',
            padding: '2px 5px',
            borderRadius: 3,
          }}
        >
          {isQuerying ? 'Analyzing...' : 'Ask AI'}
        </span>
      </button>
    </div>
  );
}
const COLS = [
  { key: 'ts', label: 'TimeStamp', w: 130 },
  { key: 'sym', label: 'Symbol', w: 72 },
  { key: 'tf', label: 'TF', w: 45 },
  { key: 'close', label: 'Close', w: 72 },
  { key: 'impHi', label: 'Imp High', w: 72 },
  { key: 'impLo', label: 'Imp Low', w: 72 },
  { key: 'rej', label: 'High/Low + Rej', w: 95 },
  { key: 'tcP1', label: 'TC P1', w: 46 },
  { key: 'tcP2', label: 'TC P2', w: 46 },
  { key: 'tcP3', label: 'TC P3', w: 46 },
  { key: 'tcB1', label: 'TC B1', w: 46 },
  { key: 'tcB2', label: 'TC B2', w: 46 },
  { key: 'tcB3', label: 'TC B3', w: 46 },
  { key: 'sarP1', label: 'S&R P1', w: 72 },
  { key: 'sarP2', label: 'S&R P2', w: 72 },
  { key: 'sarP3', label: 'S&R P3', w: 72 },
  { key: 'sarB1', label: 'S&R B1', w: 72 },
  { key: 'sarB2', label: 'S&R B2', w: 72 },
  { key: 'sarB3', label: 'S&R B3', w: 72 },
  { key: 'prop', label: 'Touch Propensity', w: 95 },
];

// Generate a timestamp snapped to 5-min boundaries
function fiveMinTs(offsetMins = 0) {
  const now = new Date(Date.now() - offsetMins * 60000);
  now.setSeconds(0, 0);
  now.setMinutes(Math.floor(now.getMinutes() / 5) * 5);
  return now.toISOString().replace('T', ' ').slice(0, 16);
}

function genRow(sym, tf, base, vol, offsetMins) {
  const dp = base < 10 ? 4 : base < 1000 ? 3 : 2;
  const close = +(base + (Math.random() - 0.5) * vol * 2).toFixed(dp);
  const dash = '-----';
  const tc = () =>
    Math.random() > 0.55 ? Math.floor(Math.random() * 6) + 1 : dash;
  const sar = () =>
    Math.random() > 0.55
      ? Math.random() > 0.5
        ? 'Resistant'
        : 'Support'
      : dash;
  return {
    ts: fiveMinTs(offsetMins),
    sym,
    tf,
    close,
    impHi:
      Math.random() > 0.65
        ? +(close + Math.random() * vol * 2).toFixed(dp)
        : dash,
    impLo:
      Math.random() > 0.65
        ? +(close - Math.random() * vol * 2).toFixed(dp)
        : dash,
    rej:
      Math.random() > 0.8
        ? Math.random() > 0.5
          ? 'Bullish Rej'
          : 'Bearish Rej'
        : dash,
    tcP1: tc(),
    tcP2: tc(),
    tcP3: tc(),
    tcB1: tc(),
    tcB2: tc(),
    tcB3: tc(),
    sarP1: sar(),
    sarP2: sar(),
    sarP3: sar(),
    sarB1: sar(),
    sarB2: sar(),
    sarB3: sar(),
    prop: Math.random() > 0.5 ? 'Resistant' : 'Support',
  };
}

function cellColor(key, val) {
  if (val === '-----') return '#2a3050';
  if (key === 'prop' || key.startsWith('sar'))
    return val === 'Resistant' ? '#ef5350' : '#26a69a';
  if (key === 'rej')
    return val.includes('Bullish')
      ? '#26a69a'
      : val.includes('Bearish')
        ? '#ef5350'
        : '#4a5a80';
  if (key === 'close') return '#e2e8f0';
  if (typeof val === 'number') return '#7dd3fc';
  return '#94a3b8';
}

function DataTable({ sym, tf, onQueryAI, isQuerying }) {
  const [rows, setRows] = useState([]);
  const tbRef = useRef(null);
  const base = BASE_PRICES[sym] || 2651;
  const vol = VOLATILITY[sym] || 7;

  useEffect(() => {
    // Seed with 20 historical rows, each 5 mins apart
    setRows(
      Array.from({ length: 20 }, (_, i) =>
        genRow(sym, tf, base, vol, (20 - i) * 5)
      )
    );
  }, [sym, tf]);

  // New row every 5 minutes (300000ms) — using 5min-aligned timestamps
  useEffect(() => {
    const id = setInterval(() => {
      setRows((prev) => [...prev, genRow(sym, tf, base, vol, 0)].slice(-60));
    }, 300000);
    return () => clearInterval(id);
  }, [sym, tf]);

  useEffect(() => {
    if (tbRef.current) tbRef.current.scrollTop = tbRef.current.scrollHeight;
  }, [rows]);

  const th = {
    padding: '4px 8px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderRight: '1px solid #1a2a50',
    color: '#e2e8f0',
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 600,
  };
  const td = (key, val) => ({
    padding: '3px 8px',
    borderRight: '1px solid #111825',
    whiteSpace: 'nowrap',
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    color: cellColor(key, val),
  });

  return (
    <div
      style={{
        flexShrink: 0,
        height: 220,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid #1a2035',
      }}
    >
      <div
        style={{
          padding: '5px 12px',
          background: '#0d1220',
          borderBottom: '1px solid #1a2035',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <img
          src={MASCOT_IMG}
          alt=""
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: '#f59e0b',
            fontFamily: "'JetBrains Mono',monospace",
            fontWeight: 700,
          }}
        >
          Real-Time Technical Feed
        </span>
        <span
          style={{ fontSize: 10, color: '#22c55e', fontFamily: 'monospace' }}
        >
          ● AUTO SCROLL
        </span>
        {/* Ask AI button for feed */}
        <button
          onClick={() => onQueryAI('feed', rows)}
          disabled={isQuerying || rows.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: isQuerying || rows.length === 0 ? 'wait' : 'pointer',
            opacity: isQuerying ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          <div style={{ position: 'relative' }}>
            <img
              src={MASCOT_IMG}
              alt="DavinTrade AI"
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                border: `2px solid ${isQuerying ? '#f59e0b' : '#2a3a5a'}`,
                objectFit: 'cover',
                objectPosition: 'center top',
                background: '#0d1220',
                boxShadow: isQuerying ? '0 0 8px #f59e0b88' : 'none',
                transition: 'all 0.2s',
              }}
            />
            {isQuerying && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '2px solid #f59e0b',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            )}
          </div>
          <span
            style={{
              fontSize: 10,
              color: '#f59e0b',
              fontFamily: "'JetBrains Mono',monospace",
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            {isQuerying ? 'Analyzing...' : 'Ask AI'}
          </span>
        </button>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: '#4a5a80',
            fontFamily: 'monospace',
          }}
        >
          {sym} · {tf} · {rows.length} rows · updates every 5min
        </span>
      </div>
      <div
        ref={tbRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}
      >
        <table
          style={{ borderCollapse: 'collapse', minWidth: 1500, width: '100%' }}
        >
          <thead
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 5,
              background: '#0f2040',
            }}
          >
            <tr>
              {COLS.map((c) => (
                <th key={c.key} style={{ ...th, minWidth: c.w }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                style={{ background: ri % 2 === 0 ? '#080c16' : '#0a0e1a' }}
              >
                {COLS.map((c) => (
                  <td key={c.key} style={td(c.key, row[c.key])}>
                    {String(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── AI Chat Panel ────────────────────────────────────────────────────────────
const INDICATOR_PROMPTS = {
  trendline: `The user clicked "Ask AI" on the Trendline Indicator chart. Provide a concise overview analysis of what you observe from the trendline patterns — diagonal support/resistance lines from swing highs/lows and horizontal S/R levels. Reference the most recent price action relative to these trendlines. Then end with 2-3 focused questions to continue the conversation with the user.`,
  keltner: `The user clicked "Ask AI" on the Keltner Channel Indicator chart. Provide a concise overview analysis — EMA(20) midline, ATR(10)×2 upper/lower bands — noting whether price is hugging the upper band (bullish momentum), lower band (bearish), or inside (consolidation). Mention mean-reversion vs breakout potential. Then end with 2-3 focused questions to continue the conversation.`,
  tema: `The user clicked "Ask AI" on the TEMA/HRMA/EMA Indicator chart. Provide a concise overview analysis of the three MAs: TEMA(9) in blue (fast), HRMA(21) in amber (medium), EMA(50) in purple (slow). Comment on their current alignment (stacked bull/bear or tangled/ranging), recent crossovers, and momentum direction. Then end with 2-3 focused questions to continue the conversation.`,
  zigzag: `The user clicked "Ask AI" on the ZigZag Indicator chart. Provide a concise overview analysis of the ZigZag swing structure — identify whether the pattern shows Higher Highs + Higher Lows (uptrend), Lower Highs + Lower Lows (downtrend), or a ranging structure. Note the most recent swing pivot and its implication. Then end with 2-3 focused questions to continue the conversation.`,
  flex_zigzag: `The user clicked "Ask AI" on the ZigZag Indicator (flex panel). Provide a concise overview analysis of the ZigZag swing structure — identify whether the pattern shows Higher Highs + Higher Lows (uptrend), Lower Highs + Lower Lows (downtrend), or a ranging structure. Note the most recent swing pivot and its implication. Then end with 2-3 focused questions to continue the conversation.`,
  flex_heikin: `The user clicked "Ask AI" on the Heikin Ashi chart. Analyze the Heikin Ashi candle pattern — note the current candle body size, color streak (bullish/bearish run), presence of upper/lower wicks, and what any transition candles indicate about momentum change. Then end with 2-3 focused questions to continue the conversation.`,
  flex_emasmma: `The user clicked "Ask AI" on the EMA & SMMA chart. Analyze the four moving averages: EMA(9) blue (fastest), EMA(21) amber (medium-fast), SMMA(34) green dashed (smooth medium), SMMA(89) pink dashed (trend baseline). Comment on their stacking order, any recent crossovers, and whether price is above or below the SMMA(89). Then end with 2-3 focused questions to continue the conversation.`,
  feed: (rows) => {
    const last4 = rows.slice(-4);
    const formatted = last4
      .map(
        (r, i) =>
          `Row ${i + 1} [${r.ts}] | Close: ${r.close} | Imp High: ${r.impHi} | Imp Low: ${r.impLo} | High/Low+Rej: ${r.rej} | TC P1:${r.tcP1} P2:${r.tcP2} P3:${r.tcP3} B1:${r.tcB1} B2:${r.tcB2} B3:${r.tcB3} | S&R P1:${r.sarP1} P2:${r.sarP2} P3:${r.sarP3} B1:${r.sarB1} B2:${r.sarB2} B3:${r.sarB3} | Propensity:${r.prop}`
      )
      .join('\n');
    return `The user clicked "Ask AI" on the Real-Time Technical Feed. Here are the last 4 rows of live data:\n\n${formatted}\n\nProvide a concise technical analysis overview covering ALL columns: interpret any Important High/Low levels present, note Touch Count accumulations on Pivots vs Bars, flag any Bearish/Bullish Rejection signals, assess the dominant Support vs Resistant bias from the S&R columns, and comment on Touch Propensity trend. Highlight the most notable/concerning events or patterns across these rows. Then end with 2-3 sharp, responsive follow-up questions based specifically on what you observe in this data.`;
  },
};

function ChatPanel({ sym, tf, chartData, pendingQuery, onQueryHandled }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const systemPrompt = `You are DavinTrade AI, an expert quantitative trading analyst embedded in the DavinTrade platform.

Current Context:
- Symbol: ${sym}
- Timeframe: ${tf}
- Current Price: ${chartData.length ? chartData[chartData.length - 1].close : 'N/A'}

The user is viewing 4 real-time indicator charts:
1. Trendline — Fractal-based diagonal support/resistance trendlines and horizontal S/R levels
2. Keltner Channel — EMA(20) midline with ATR(10)×2 bands; signals breakout vs mean-reversion
3. TEMA / HRMA / EMA — TEMA(9) blue, HRMA(21) amber, EMA(50) purple; crossovers signal trend strength
4. ZigZag — Connects swing highs/lows to identify market structure (HH/HL = uptrend, LH/LL = downtrend)

Plus a real-time 5-minute data feed showing: Important High/Low levels, Touch Counts for Pivots/Bars, S&R classification, and Touch Propensity.

Be concise, specific, and actionable. Reference indicators by name. Include entry context, targets, and risk/stop notes. When providing an overview from a button click, always end with 2-3 sharp follow-up questions.`;

  useEffect(() => {
    setMsgs([
      {
        role: 'assistant',
        text: `Hello! I'm **DavinTrade AI**, analyzing **${sym}** on the **${tf}** timeframe.\n\nI have full visibility of your 4 indicator charts (Trendline, Keltner Channel, TEMA/HRMA/EMA, ZigZag) and the real-time data feed. How can I help?`,
      },
    ]);
  }, [sym, tf]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  const callAI = useCallback(
    async (userMsg, displayMsg) => {
      const shown = displayMsg || userMsg;
      setMsgs((prev) => [...prev, { role: 'user', text: shown }]);
      setLoading(true);
      try {
        const history = msgs
          .slice(-12)
          .map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
          }));
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: systemPrompt,
            messages: [...history, { role: 'user', content: userMsg }],
          }),
        });
        const data = await res.json();
        const reply =
          data.content?.[0]?.text ||
          'Unable to get a response. Please try again.';
        setMsgs((prev) => [...prev, { role: 'assistant', text: reply }]);
      } catch {
        setMsgs((prev) => [
          ...prev,
          { role: 'assistant', text: 'Connection error. Please try again.' },
        ]);
      }
      setLoading(false);
      inputRef.current?.focus();
    },
    [msgs, systemPrompt]
  );

  // Handle pending query from chart/feed button clicks
  // pendingQuery is either a string key (for charts) or { key: 'feed', rows: [...] }
  useEffect(() => {
    if (!pendingQuery || loading) return;
    const key =
      typeof pendingQuery === 'object' ? pendingQuery.key : pendingQuery;
    const rows = typeof pendingQuery === 'object' ? pendingQuery.rows : null;
    const labels = {
      trendline: 'Trendline Indicator',
      keltner: 'Keltner Channel',
      tema: 'TEMA/HRMA/EMA',
      zigzag: 'ZigZag Indicator',
      feed: 'Technical Feed',
      flex_zigzag: 'ZigZag (Flex)',
      flex_heikin: 'Heikin Ashi',
      flex_emasmma: 'EMA & SMMA',
    };
    const promptFn = INDICATOR_PROMPTS[key];
    if (!promptFn) return;
    const prompt =
      key === 'feed' && rows
        ? promptFn(rows)
        : typeof promptFn === 'function'
          ? promptFn()
          : promptFn;
    callAI(prompt, `📊 Analyze the ${labels[key] || key}`);
    onQueryHandled();
  }, [pendingQuery]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    callAI(q);
  };

  const renderText = (text) =>
    text.split('\n').map((line, li) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={li}>
          {parts.map((p, pi) =>
            p.startsWith('**') && p.endsWith('**') ? (
              <strong key={pi} style={{ color: '#f59e0b', fontWeight: 700 }}>
                {p.slice(2, -2)}
              </strong>
            ) : (
              <span key={pi}>{p}</span>
            )
          )}
          {li < text.split('\n').length - 1 && <br />}
        </span>
      );
    });

  const msgBox = (role) => ({
    maxWidth: '95%',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 11.5,
    lineHeight: 1.55,
    fontFamily: 'system-ui, sans-serif',
    background: role === 'user' ? '#1a2a45' : '#111827',
    color: role === 'user' ? '#bfdbfe' : '#d1d5db',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    border: role === 'user' ? '1px solid #1e3a60' : '1px solid #1f2937',
  });

  return (
    <div
      style={{
        width: 290,
        minWidth: 290,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #1a2035',
        background: '#080c16',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          background: '#0d1220',
          borderBottom: '1px solid #1a2035',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <img
          src={MASCOT_IMG}
          alt="DavinTrade AI"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            objectFit: 'cover',
            objectPosition: 'center top',
            border: '2px solid #d97706',
            flexShrink: 0,
          }}
        />
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#f1f5f9',
              fontFamily: 'system-ui',
            }}
          >
            DavinTrade AI
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#4a5a80',
              fontFamily: "'JetBrains Mono',monospace",
            }}
          >
            {sym} · {tf}
          </div>
        </div>
        <div
          style={{
            marginLeft: 'auto',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 6px #22c55e',
          }}
        />
      </div>
      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {m.role === 'assistant' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 3,
                }}
              >
                <img
                  src={MASCOT_IMG}
                  alt=""
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    objectPosition: 'center top',
                  }}
                />
                <span
                  style={{
                    fontSize: 9,
                    color: '#d97706',
                    fontFamily: "'JetBrains Mono',monospace",
                    fontWeight: 700,
                  }}
                >
                  DAVINTRADE AI
                </span>
              </div>
            )}
            <div style={msgBox(m.role)}>{renderText(m.text)}</div>
          </div>
        ))}
        {loading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 3,
              }}
            >
              <img
                src={MASCOT_IMG}
                alt=""
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  color: '#d97706',
                  fontFamily: "'JetBrains Mono',monospace",
                  fontWeight: 700,
                }}
              >
                DAVINTRADE AI
              </span>
            </div>
            <div
              style={{
                ...msgBox('assistant'),
                color: '#4a5a80',
                fontStyle: 'italic',
              }}
            >
              Analyzing charts...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {/* Input */}
      <div
        style={{
          padding: '8px',
          borderTop: '1px solid #1a2035',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about indicators, signals..."
            style={{
              flex: 1,
              background: '#0f1628',
              color: '#d1d5db',
              border: '1px solid #1f2d4a',
              borderRadius: 6,
              padding: '7px 10px',
              fontSize: 11.5,
              outline: 'none',
              fontFamily: 'system-ui',
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              padding: '7px 12px',
              background: input.trim() && !loading ? '#d97706' : '#1a2035',
              color: input.trim() && !loading ? '#000' : '#3a4a60',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 12,
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            ➤
          </button>
        </div>
        <div
          style={{
            marginTop: 5,
            fontSize: 9.5,
            color: '#2a3550',
            textAlign: 'center',
            fontFamily: 'system-ui',
          }}
        >
          AI can make mistakes. Review financial advice carefully.
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function DavinTradeUI() {
  const [sym, setSym] = useState('XAUUSD');
  const [tf, setTf] = useState('M15');
  const [data, setData] = useState([]);
  const [pendingQuery, setPendingQuery] = useState(null);
  const [queryingChart, setQueryingChart] = useState(null);

  useEffect(() => {
    setData(genOHLC(80, BASE_PRICES[sym] || 2651, VOLATILITY[sym] || 7));
  }, [sym, tf]);

  // Auto-refresh candle every 5 minutes (300000ms)
  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        const vol = VOLATILITY[sym] || 7;
        const dp = last.close < 10 ? 5 : last.close < 1000 ? 3 : 2;
        const close = +(last.close + (Math.random() - 0.485) * vol).toFixed(dp);
        const high = +(
          Math.max(last.close, close) +
          Math.random() * vol * 0.4
        ).toFixed(dp);
        const low = +(
          Math.min(last.close, close) -
          Math.random() * vol * 0.4
        ).toFixed(dp);
        return [
          ...prev.slice(1),
          { open: last.close, high, low, close, time: new Date() },
        ];
      });
    }, 300000);
    return () => clearInterval(id);
  }, [sym]);

  // indicatorKey is a string for charts, or 'feed' with rows for the data table
  const handleQueryAI = (indicatorKey, rows) => {
    setQueryingChart(indicatorKey);
    if (indicatorKey === 'feed' && rows) {
      setPendingQuery({ key: 'feed', rows });
    } else {
      setPendingQuery(indicatorKey);
    }
  };

  const handleQueryHandled = () => {
    setQueryingChart(null);
    setPendingQuery(null);
  };

  const charts = [
    {
      key: 'trendline',
      label: `${sym} ${tf}  ·  Trendline Indicator`,
      ovFn: ovTrendline,
    },
    {
      key: 'keltner',
      label: `${sym} ${tf}  ·  Keltner Channel Indicator`,
      ovFn: ovKeltner,
    },
    {
      key: 'tema',
      label: `${sym} ${tf}  ·  TEMA / HRMA / EMA Indicator`,
      ovFn: ovTEMA,
    },
  ];

  const btn = (val, cur) => ({
    padding: '4px 9px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono',monospace",
    border: 'none',
    transition: 'all 0.15s',
    background: val === cur ? '#d97706' : '#111827',
    color: val === cur ? '#000' : '#4a5a80',
  });

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#050810',
        color: '#d1d5db',
        overflow: 'hidden',
        fontFamily: 'system-ui',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #080c16; }
        ::-webkit-scrollbar-thumb { background: #1a2a40; border-radius: 3px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin   { to { transform: rotate(360deg); } }
      `}</style>

      <ChatPanel
        sym={sym}
        tf={tf}
        chartData={data}
        pendingQuery={pendingQuery}
        onQueryHandled={handleQueryHandled}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: '8px 14px',
            background: '#0a0e1a',
            borderBottom: '1px solid #1a2035',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                color: '#3a4a60',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono',monospace",
                letterSpacing: '0.08em',
              }}
            >
              Symbol
            </span>
            <select
              value={sym}
              onChange={(e) => setSym(e.target.value)}
              style={{
                background: '#111827',
                color: '#f59e0b',
                border: '1px solid #1f2d4a',
                borderRadius: 5,
                padding: '4px 8px',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono',monospace",
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div style={{ width: 1, height: 18, background: '#1a2035' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                color: '#3a4a60',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono',monospace",
                letterSpacing: '0.08em',
              }}
            >
              Timeframe
            </span>
            <div style={{ display: 'flex', gap: 3 }}>
              {TIMEFRAMES.map((t) => (
                <button key={t} style={btn(t, tf)} onClick={() => setTf(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#22c55e',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: '#22c55e',
                fontFamily: "'JetBrains Mono',monospace",
              }}
            >
              Auto Refresh
            </span>
          </div>
        </div>

        {/* 2×2 Chart Grid */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: 4,
            padding: 4,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {data.length > 0 &&
            charts.map((ch) => (
              <ChartPanel
                key={ch.key}
                label={ch.label}
                indicatorKey={ch.key}
                data={data}
                ovFn={ch.ovFn}
                onQueryAI={handleQueryAI}
                isQuerying={queryingChart === ch.key}
              />
            ))}
          {/* Bottom-right: user-selectable flex panel */}
          {data.length > 0 && (
            <FlexChartPanel
              sym={sym}
              tf={tf}
              data={data}
              onQueryAI={handleQueryAI}
              isQuerying={queryingChart?.startsWith?.('flex_')}
            />
          )}
        </div>

        {/* Data Table */}
        <DataTable
          sym={sym}
          tf={tf}
          onQueryAI={handleQueryAI}
          isQuerying={queryingChart === 'feed'}
        />
      </div>
    </div>
  );
}
