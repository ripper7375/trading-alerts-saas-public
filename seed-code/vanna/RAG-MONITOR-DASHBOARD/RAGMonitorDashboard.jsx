import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const tokenTimelineData = [
  { time: '00:00', free: 42000, pro: 180000, vanna: 15000 },
  { time: '02:00', free: 18000, pro: 94000, vanna: 8000 },
  { time: '04:00', free: 9000, pro: 51000, vanna: 4200 },
  { time: '06:00', free: 25000, pro: 130000, vanna: 11000 },
  { time: '08:00', free: 87000, pro: 420000, vanna: 38000 },
  { time: '10:00', free: 194000, pro: 810000, vanna: 72000 },
  { time: '12:00', free: 230000, pro: 1100000, vanna: 95000 },
  { time: '14:00', free: 218000, pro: 980000, vanna: 88000 },
  { time: '16:00', free: 175000, pro: 720000, vanna: 64000 },
  { time: '18:00', free: 145000, pro: 540000, vanna: 51000 },
  { time: '20:00', free: 112000, pro: 390000, vanna: 34000 },
  { time: '22:00', free: 78000, pro: 260000, vanna: 23000 },
];

const costByModelData = [
  { model: 'gemini-2.5-flash', cost: 4.82, queries: 2410, tier: 'FREE' },
  { model: 'claude-sonnet-4', cost: 38.4, queries: 960, tier: 'PRO' },
  { model: 'claude-opus-4', cost: 12.6, queries: 70, tier: 'PRO' },
  { model: 'gpt-4o', cost: 9.15, queries: 183, tier: 'PRO' },
  { model: 'gemini-pro', cost: 6.3, queries: 420, tier: 'PRO' },
];

const queryVolumeData = [
  { day: 'Mon', free: 1820, pro: 740, peak: 310 },
  { day: 'Tue', free: 2140, pro: 890, peak: 420 },
  { day: 'Wed', free: 1990, pro: 820, peak: 380 },
  { day: 'Thu', free: 2410, pro: 960, peak: 490 },
  { day: 'Fri', free: 2780, pro: 1120, peak: 540 },
  { day: 'Sat', free: 1440, pro: 630, peak: 210 },
  { day: 'Sun', free: 1100, pro: 490, peak: 160 },
];

const costDailyTrend = [
  { day: '25 Feb', cost: 48.2 },
  { day: '26 Feb', cost: 52.7 },
  { day: '27 Feb', cost: 45.1 },
  { day: '28 Feb', cost: 61.4 },
  { day: '01 Mar', cost: 58.9 },
  { day: '02 Mar', cost: 67.3 },
  { day: '03 Mar', cost: 71.3 },
  { day: '04 Mar', cost: 63.8 },
  { day: '05 Mar', cost: 44.2 },
];

const abuseFlagsData = [
  {
    id: 'usr_4f2a',
    tier: 'FREE',
    layer: 'L1 · Per-Min',
    count: 18,
    model: 'gemini-2.5-flash',
    lastSeen: '14:32:07',
    action: 'throttled',
  },
  {
    id: 'usr_8b1c',
    tier: 'PRO',
    layer: 'L3 · Monthly',
    count: 3,
    model: 'claude-opus-4',
    lastSeen: '13:55:41',
    action: 'capped',
  },
  {
    id: 'usr_2e9d',
    tier: 'FREE',
    layer: 'L2 · Daily',
    count: 7,
    model: 'gemini-2.5-flash',
    lastSeen: '12:18:22',
    action: 'capped',
  },
  {
    id: 'usr_7a3f',
    tier: 'PRO',
    layer: 'L1 · Per-Min',
    count: 12,
    model: 'gpt-4o',
    lastSeen: '11:47:59',
    action: 'throttled',
  },
  {
    id: 'usr_1d5e',
    tier: 'FREE',
    layer: 'L4 · Concurrent',
    count: 2,
    model: 'gemini-2.5-flash',
    lastSeen: '10:03:14',
    action: 'blocked',
  },
  {
    id: 'usr_9c4b',
    tier: 'PRO',
    layer: 'L2 · Daily',
    count: 5,
    model: 'claude-sonnet-4',
    lastSeen: '09:28:33',
    action: 'capped',
  },
];

const tierSplitData = [
  { name: 'FREE', value: 2410 },
  { name: 'PRO (Sonnet)', value: 960 },
  { name: 'PRO (Opus)', value: 70 },
  { name: 'PRO (GPT-4o)', value: 183 },
  { name: 'PRO (Gemini)', value: 420 },
];

const TIER_COLORS = ['#2dd4bf', '#f59e0b', '#f97316', '#818cf8', '#34d399'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(2)}M`
    : n >= 1e3
      ? `${(n / 1e3).toFixed(1)}K`
      : n;

const ActionBadge = ({ action }) => {
  const map = {
    throttled: {
      bg: '#fbbf2420',
      border: '#fbbf24',
      text: '#fbbf24',
      label: 'THROTTLED',
    },
    capped: {
      bg: '#f9731620',
      border: '#f97316',
      text: '#f97316',
      label: 'CAPPED',
    },
    blocked: {
      bg: '#ef444420',
      border: '#ef4444',
      text: '#ef4444',
      label: 'BLOCKED',
    },
  };
  const s = map[action] || map.blocked;
  return (
    <span
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        padding: '2px 8px',
        borderRadius: 3,
        fontSize: 10,
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: '0.08em',
        fontWeight: 700,
      }}
    >
      {s.label}
    </span>
  );
};

const LayerBadge = ({ layer }) => {
  const colors = { L1: '#2dd4bf', L2: '#f59e0b', L3: '#f97316', L4: '#ef4444' };
  const key = layer.split(' ')[0];
  return (
    <span
      style={{
        color: colors[key] || '#94a3b8',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {layer}
    </span>
  );
};

const TierBadge = ({ tier }) => (
  <span
    style={{
      background: tier === 'PRO' ? '#f59e0b18' : '#2dd4bf18',
      border: `1px solid ${tier === 'PRO' ? '#f59e0b' : '#2dd4bf'}`,
      color: tier === 'PRO' ? '#f59e0b' : '#2dd4bf',
      padding: '1px 7px',
      borderRadius: 2,
      fontSize: 10,
      fontFamily: "'IBM Plex Mono', monospace",
      fontWeight: 700,
      letterSpacing: '0.05em',
    }}
  >
    {tier}
  </span>
);

const KpiCard = ({ label, value, sub, accent, delta, deltaUp }) => (
  <div
    style={{
      background: '#0d1520',
      border: `1px solid ${accent}30`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 6,
      padding: '16px 20px',
      flex: 1,
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 60,
        height: 60,
        background: `radial-gradient(circle at top right, ${accent}18, transparent 70%)`,
        pointerEvents: 'none',
      }}
    />
    <div
      style={{
        color: '#4b6285',
        fontSize: 10,
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {label}
    </div>
    <div
      style={{
        color: accent,
        fontSize: 28,
        fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}
    >
      {value}
    </div>
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}
    >
      <span style={{ color: '#4b6285', fontSize: 11 }}>{sub}</span>
      {delta && (
        <span
          style={{
            color: deltaUp ? '#2dd4bf' : '#ef4444',
            fontSize: 11,
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {deltaUp ? '▲' : '▼'} {delta}
        </span>
      )}
    </div>
  </div>
);

const Panel = ({ title, badge, children, style = {} }) => (
  <div
    style={{
      background: '#0d1520',
      border: '1px solid #1a2d45',
      borderRadius: 8,
      padding: '20px',
      ...style,
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 3,
            height: 14,
            background: '#2dd4bf',
            borderRadius: 2,
          }}
        />
        <span
          style={{
            color: '#e2e8f0',
            fontSize: 12,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </span>
      </div>
      {badge && (
        <span
          style={{
            background: '#ffffff08',
            color: '#4b6285',
            fontSize: 10,
            fontFamily: "'IBM Plex Mono', monospace",
            padding: '3px 8px',
            borderRadius: 3,
            letterSpacing: '0.08em',
          }}
        >
          {badge}
        </span>
      )}
    </div>
    {children}
  </div>
);

const CUSTOM_TOOLTIP = ({
  active,
  payload,
  label,
  prefix = '',
  suffix = '',
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#0a0f1a',
        border: '1px solid #1a2d45',
        borderRadius: 6,
        padding: '10px 14px',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
      }}
    >
      <div style={{ color: '#4b6285', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            color: p.color,
            display: 'flex',
            gap: 12,
            justifyContent: 'space-between',
          }}
        >
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>
            {prefix}
            {typeof p.value === 'number' ? fmt(p.value) : p.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── THROTTLE CONTROL ────────────────────────────────────────────────────────

const ControlSlider = ({ label, value, max, unit, color, onChange }) => (
  <div style={{ marginBottom: 14 }}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 5,
      }}
    >
      <span
        style={{
          color: '#94a3b8',
          fontSize: 11,
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color,
          fontSize: 11,
          fontFamily: "'IBM Plex Mono', monospace",
          fontWeight: 700,
        }}
      >
        {value} {unit}
      </span>
    </div>
    <div
      style={{
        position: 'relative',
        height: 4,
        background: '#1a2d45',
        borderRadius: 2,
      }}
    >
      <div
        style={{
          width: `${(value / max) * 100}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 2,
          transition: 'width 0.2s',
        }}
      />
      <input
        type="range"
        min={1}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          width: '100%',
          transform: 'translateY(-50%)',
          opacity: 0,
          cursor: 'pointer',
          height: 16,
        }}
      />
    </div>
  </div>
);

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────

export default function RAGMonitorDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [now, setNow] = useState(new Date());
  const [controls, setControls] = useState({
    freePerMin: 3,
    proPerMin: 10,
    freePerDay: 20,
    proPerDay: 40,
    freePerMonth: 200,
    proPerMonth: 200,
    costCap: 10,
  });
  const [alertUser, setAlertUser] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const totalTokensToday = tokenTimelineData.reduce(
    (s, d) => s + d.free + d.pro + d.vanna,
    0
  );
  const totalCostToday = costDailyTrend[costDailyTrend.length - 1].cost;
  const totalQueriesHour =
    queryVolumeData.reduce((s, d) => s + d.free + d.pro, 0) / 7;
  const totalAbuse = abuseFlagsData.length;

  const TABS = ['overview', 'tokens', 'costs', 'queries', 'abuse', 'controls'];

  return (
    <div
      style={{
        background: '#070d16',
        minHeight: '100vh',
        fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
        color: '#e2e8f0',
        padding: '0',
      }}
    >
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;600;700&display=swap');
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0d1520; }
        ::-webkit-scrollbar-thumb { background: #1a2d45; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { width: 12px; height: 12px; border-radius: 50%; background: #2dd4bf; cursor: pointer; -webkit-appearance: none; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes blink { 0%,100%{opacity:1}49%{opacity:1}50%{opacity:0}99%{opacity:0} }
      `}</style>

      {/* HEADER */}
      <div
        style={{
          background: '#0a0f1a',
          borderBottom: '1px solid #1a2d45',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#2dd4bf',
                animation: 'pulse 2s infinite',
                boxShadow: '0 0 8px #2dd4bf',
              }}
            />
            <span
              style={{
                color: '#2dd4bf',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}
            >
              DAVIN<span style={{ color: '#4b6285' }}>TRADE</span>
            </span>
          </div>
          <div style={{ width: 1, height: 20, background: '#1a2d45' }} />
          <span
            style={{ color: '#4b6285', fontSize: 11, letterSpacing: '0.1em' }}
          >
            RAG · OBSERVABILITY · v3.3
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                color: '#2dd4bf',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              {now.toTimeString().slice(0, 8)}
              <span
                style={{
                  animation: 'blink 1s step-start infinite',
                  marginLeft: 2,
                }}
              >
                _
              </span>
            </div>
            <div style={{ color: '#4b6285', fontSize: 10 }}>
              UTC+0 · 05 MAR 2026
            </div>
          </div>
          <div
            style={{
              background: '#ef444418',
              border: '1px solid #ef444440',
              color: '#ef4444',
              padding: '4px 12px',
              borderRadius: 4,
              fontSize: 10,
              letterSpacing: '0.1em',
            }}
          >
            ⚠ {totalAbuse} ABUSE FLAGS
          </div>
        </div>
      </div>

      {/* TABS */}
      <div
        style={{
          background: '#0a0f1a',
          borderBottom: '1px solid #1a2d45',
          padding: '0 28px',
          display: 'flex',
          gap: 2,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              background: activeTab === t ? '#0d1520' : 'transparent',
              border: 'none',
              borderBottom:
                activeTab === t ? '2px solid #2dd4bf' : '2px solid transparent',
              color: activeTab === t ? '#2dd4bf' : '#4b6285',
              padding: '10px 16px',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
        {/* ── KPI ROW (always visible) ── */}
        <div
          style={{
            display: 'flex',
            gap: 14,
            marginBottom: 22,
            flexWrap: 'wrap',
          }}
        >
          <KpiCard
            label="Tokens Today"
            value={fmt(totalTokensToday)}
            sub="input + output + vanna"
            accent="#2dd4bf"
            delta="12.4%"
            deltaUp={true}
          />
          <KpiCard
            label="LLM Cost Today"
            value={`$${totalCostToday.toFixed(2)}`}
            sub="all models · all tiers"
            accent="#f59e0b"
            delta="8.1%"
            deltaUp={false}
          />
          <KpiCard
            label="Avg Queries / hr"
            value={Math.round(totalQueriesHour)}
            sub="7-day avg · FREE + PRO"
            accent="#818cf8"
            delta="3.7%"
            deltaUp={true}
          />
          <KpiCard
            label="Abuse Flags"
            value={totalAbuse}
            sub="last 24h · all layers"
            accent="#ef4444"
            delta="active"
            deltaUp={false}
          />
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}
          >
            {/* Token Overview */}
            <Panel title="Token Usage · 24h" badge="INPUT + OUTPUT + VANNA">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={tokenTimelineData}
                  margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                >
                  <defs>
                    {[
                      ['free', '#2dd4bf'],
                      ['pro', '#f59e0b'],
                      ['vanna', '#818cf8'],
                    ].map(([k, c]) => (
                      <linearGradient
                        key={k}
                        id={`g_${k}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="5%" stopColor={c} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={c} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    stroke="#1a2d45"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#4b6285', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmt}
                    tick={{ fill: '#4b6285', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Area
                    type="monotone"
                    dataKey="free"
                    name="FREE"
                    stroke="#2dd4bf"
                    fill="url(#g_free)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="pro"
                    name="PRO"
                    stroke="#f59e0b"
                    fill="url(#g_pro)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="vanna"
                    name="VANNA"
                    stroke="#818cf8"
                    fill="url(#g_vanna)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            {/* Query Volume */}
            <Panel title="Query Volume · 7-Day" badge="ALL TIERS">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={queryVolumeData}
                  margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    stroke="#1a2d45"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#4b6285', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#4b6285', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                  />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Bar
                    dataKey="free"
                    name="FREE"
                    fill="#2dd4bf"
                    opacity={0.75}
                    radius={[2, 2, 0, 0]}
                    stackId="a"
                  />
                  <Bar
                    dataKey="pro"
                    name="PRO"
                    fill="#f59e0b"
                    opacity={0.75}
                    radius={[2, 2, 0, 0]}
                    stackId="a"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            {/* Cost by Model */}
            <Panel title="Cost by Model · Today" badge="USD">
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {costByModelData.map((m, i) => (
                  <div
                    key={m.model}
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <TierBadge tier={m.tier} />
                    <span
                      style={{
                        color: '#94a3b8',
                        fontSize: 11,
                        width: 130,
                        flexShrink: 0,
                      }}
                    >
                      {m.model}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 4,
                        background: '#1a2d45',
                        borderRadius: 2,
                      }}
                    >
                      <div
                        style={{
                          width: `${(m.cost / 40) * 100}%`,
                          height: '100%',
                          background: TIER_COLORS[i % TIER_COLORS.length],
                          borderRadius: 2,
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        color: TIER_COLORS[i % TIER_COLORS.length],
                        fontSize: 12,
                        fontWeight: 700,
                        width: 48,
                        textAlign: 'right',
                      }}
                    >
                      ${m.cost.toFixed(2)}
                    </span>
                    <span
                      style={{
                        color: '#4b6285',
                        fontSize: 10,
                        width: 55,
                        textAlign: 'right',
                      }}
                    >
                      {m.queries} q
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Abuse Summary */}
            <Panel title="Rate Limit Events · 24h" badge="ALL LAYERS">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {abuseFlagsData.slice(0, 5).map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      background: '#070d16',
                      border: '1px solid #1a2d45',
                      borderRadius: 4,
                    }}
                  >
                    <span
                      style={{
                        color: '#2dd4bf',
                        fontSize: 11,
                        fontWeight: 700,
                        width: 72,
                      }}
                    >
                      {u.id}
                    </span>
                    <TierBadge tier={u.tier} />
                    <LayerBadge layer={u.layer} />
                    <span style={{ flex: 1 }} />
                    <span style={{ color: '#4b6285', fontSize: 10 }}>
                      {u.lastSeen}
                    </span>
                    <ActionBadge action={u.action} />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {/* ── TOKENS TAB ── */}
        {activeTab === 'tokens' && (
          <div
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}
          >
            <Panel
              title="Token Timeline · 24h"
              badge="INPUT + OUTPUT + VANNA"
              style={{ gridColumn: '1 / -1' }}
            >
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={tokenTimelineData}
                  margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                >
                  <defs>
                    {[
                      ['free', '#2dd4bf'],
                      ['pro', '#f59e0b'],
                      ['vanna', '#818cf8'],
                    ].map(([k, c]) => (
                      <linearGradient
                        key={k}
                        id={`tg_${k}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={c} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    stroke="#1a2d45"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#4b6285', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmt}
                    tick={{ fill: '#4b6285', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Area
                    type="monotone"
                    dataKey="free"
                    name="FREE (gemini-flash)"
                    stroke="#2dd4bf"
                    fill="url(#tg_free)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="pro"
                    name="PRO (all models)"
                    stroke="#f59e0b"
                    fill="url(#tg_pro)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="vanna"
                    name="VANNA (admin)"
                    stroke="#818cf8"
                    fill="url(#tg_vanna)"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 3"
                  />
                  <Legend
                    wrapperStyle={{
                      color: '#4b6285',
                      fontSize: 10,
                      paddingTop: 10,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Budget Consumption" badge="PRO TIER">
              {[
                {
                  model: 'claude-sonnet-4',
                  budget: 1500000,
                  used: 840000,
                  color: '#f59e0b',
                },
                {
                  model: 'claude-opus-4',
                  budget: 500000,
                  used: 392000,
                  color: '#f97316',
                },
                {
                  model: 'gpt-4o',
                  budget: 1500000,
                  used: 620000,
                  color: '#818cf8',
                },
                {
                  model: 'gemini-pro',
                  budget: 1500000,
                  used: 290000,
                  color: '#34d399',
                },
              ].map((m) => (
                <div key={m.model} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>
                      {m.model}
                    </span>
                    <span
                      style={{ color: m.color, fontSize: 11, fontWeight: 700 }}
                    >
                      {fmt(m.used)} / {fmt(m.budget)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: '#1a2d45',
                      borderRadius: 3,
                    }}
                  >
                    <div
                      style={{
                        width: `${(m.used / m.budget) * 100}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${m.color}66, ${m.color})`,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div style={{ color: '#4b6285', fontSize: 10, marginTop: 3 }}>
                    {((m.used / m.budget) * 100).toFixed(1)}% of monthly budget
                  </div>
                </div>
              ))}
            </Panel>

            <Panel title="Query Mix" badge="TODAY">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={tierSplitData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {tierSplitData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={TIER_COLORS[i % TIER_COLORS.length]}
                        opacity={0.85}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [v + ' queries']}
                    contentStyle={{
                      background: '#0a0f1a',
                      border: '1px solid #1a2d45',
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#4b6285' }} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}

        {/* ── COSTS TAB ── */}
        {activeTab === 'costs' && (
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}
          >
            <Panel
              title="Daily Cost Trend · 9 Days"
              badge="USD"
              style={{ gridColumn: '1 / -1' }}
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={costDailyTrend}
                  margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    stroke="#1a2d45"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#4b6285', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v}`}
                    tick={{ fill: '#4b6285', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                  />
                  <Tooltip content={<CUSTOM_TOOLTIP prefix="$" />} />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    name="Total Cost"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b', r: 4, strokeWidth: 0 }}
                    activeDot={{
                      r: 6,
                      fill: '#f59e0b',
                      stroke: '#070d16',
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Cost by Model · Today">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={costByModelData}
                  layout="vertical"
                  margin={{ top: 4, right: 40, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    stroke="#1a2d45"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${v}`}
                    tick={{ fill: '#4b6285', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="model"
                    tick={{ fill: '#94a3b8', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip content={<CUSTOM_TOOLTIP prefix="$" />} />
                  <Bar dataKey="cost" name="Cost USD" radius={[0, 3, 3, 0]}>
                    {costByModelData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={TIER_COLORS[i % TIER_COLORS.length]}
                        opacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Unit Economics · Per Query">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  {
                    model: 'gemini-2.5-flash',
                    tier: 'FREE',
                    input: '$0.15/1M',
                    output: '$0.60/1M',
                    perQ: '$0.002',
                    color: '#2dd4bf',
                  },
                  {
                    model: 'claude-sonnet-4',
                    tier: 'PRO',
                    input: '$3/1M',
                    output: '$15/1M',
                    perQ: '$0.066',
                    color: '#f59e0b',
                  },
                  {
                    model: 'claude-opus-4',
                    tier: 'PRO',
                    input: '$15/1M',
                    output: '$75/1M',
                    perQ: '$0.330',
                    color: '#f97316',
                  },
                  {
                    model: 'gpt-4o',
                    tier: 'PRO',
                    input: '$2.5/1M',
                    output: '$10/1M',
                    perQ: '$0.050',
                    color: '#818cf8',
                  },
                  {
                    model: 'gemini-pro',
                    tier: 'PRO',
                    input: '$1.25/1M',
                    output: '$5/1M',
                    perQ: '$0.025',
                    color: '#34d399',
                  },
                ].map((r, i) => (
                  <div
                    key={r.model}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 50px 80px 80px 60px',
                      gap: 10,
                      padding: '10px 0',
                      borderBottom: i < 4 ? '1px solid #1a2d4540' : 'none',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ color: r.color, fontSize: 10 }}>
                      {r.model}
                    </span>
                    <TierBadge tier={r.tier} />
                    <span style={{ color: '#4b6285', fontSize: 10 }}>
                      in: {r.input}
                    </span>
                    <span style={{ color: '#4b6285', fontSize: 10 }}>
                      out: {r.output}
                    </span>
                    <span
                      style={{
                        color: r.color,
                        fontWeight: 700,
                        fontSize: 12,
                        textAlign: 'right',
                      }}
                    >
                      {r.perQ}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: '8px 10px',
                  background: '#f59e0b10',
                  border: '1px solid #f59e0b30',
                  borderRadius: 4,
                  fontSize: 10,
                  color: '#4b6285',
                }}
              >
                PRO cap:{' '}
                <span style={{ color: '#f59e0b' }}>$10.00 / user / month</span>{' '}
                · FREE SaaS cost:{' '}
                <span style={{ color: '#2dd4bf' }}>~$0.40 / user / month</span>
              </div>
            </Panel>
          </div>
        )}

        {/* ── QUERIES TAB ── */}
        {activeTab === 'queries' && (
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}
          >
            <Panel
              title="Query Volume · 7-Day"
              badge="STACKED BY TIER"
              style={{ gridColumn: '1 / -1' }}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={queryVolumeData}
                  margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    stroke="#1a2d45"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#4b6285', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#4b6285', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Bar
                    dataKey="free"
                    name="FREE"
                    fill="#2dd4bf"
                    opacity={0.75}
                    radius={[0, 0, 0, 0]}
                    stackId="s"
                  />
                  <Bar
                    dataKey="pro"
                    name="PRO"
                    fill="#f59e0b"
                    opacity={0.75}
                    radius={[2, 2, 0, 0]}
                    stackId="s"
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#4b6285' }} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Capacity vs Limits" badge="CURRENT">
              {[
                {
                  label: 'FREE · Per-Minute',
                  used: 2.1,
                  limit: controls.freePerMin,
                  color: '#2dd4bf',
                },
                {
                  label: 'PRO · Per-Minute',
                  used: 7.4,
                  limit: controls.proPerMin,
                  color: '#f59e0b',
                },
                {
                  label: 'FREE · Daily (avg)',
                  used: 14,
                  limit: controls.freePerDay,
                  color: '#2dd4bf',
                },
                {
                  label: 'PRO · Daily (avg)',
                  used: 31,
                  limit: controls.proPerDay,
                  color: '#f59e0b',
                },
              ].map((m) => {
                const pct = Math.min((m.used / m.limit) * 100, 100);
                const warn = pct > 80;
                return (
                  <div key={m.label} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>
                        {m.label}
                      </span>
                      <span
                        style={{
                          color: warn ? '#ef4444' : m.color,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {m.used} / {m.limit}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 5,
                        background: '#1a2d45',
                        borderRadius: 3,
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          borderRadius: 3,
                          background: warn
                            ? `linear-gradient(90deg, #ef444466, #ef4444)`
                            : `linear-gradient(90deg, ${m.color}66, ${m.color})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </Panel>

            <Panel title="Hourly Distribution · Today">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={tokenTimelineData.map((d) => ({
                    ...d,
                    total: d.free + d.pro,
                  }))}
                  margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="qg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="#1a2d45"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#4b6285', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmt}
                    tick={{ fill: '#4b6285', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total Tokens"
                    stroke="#818cf8"
                    fill="url(#qg)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}

        {/* ── ABUSE TAB ── */}
        {activeTab === 'abuse' && (
          <div
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}
          >
            <Panel
              title="Rate Limit Violations · 24h"
              badge={`${abuseFlagsData.length} EVENTS`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 55px 130px 120px 80px 80px 90px',
                    gap: 8,
                    padding: '0 10px 8px',
                    borderBottom: '1px solid #1a2d45',
                  }}
                >
                  {[
                    'USER ID',
                    'TIER',
                    'LAYER',
                    'MODEL',
                    'HITS',
                    'LAST SEEN',
                    'ACTION',
                  ].map((h) => (
                    <span
                      key={h}
                      style={{
                        color: '#4b6285',
                        fontSize: 9,
                        letterSpacing: '0.1em',
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {abuseFlagsData.map((u) => (
                  <div
                    key={u.id}
                    onClick={() =>
                      setAlertUser(alertUser === u.id ? null : u.id)
                    }
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        '80px 55px 130px 120px 80px 80px 90px',
                      gap: 8,
                      padding: '10px 10px',
                      background: alertUser === u.id ? '#ef444410' : '#070d16',
                      border: `1px solid ${alertUser === u.id ? '#ef444430' : '#1a2d45'}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        color: '#2dd4bf',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {u.id}
                    </span>
                    <TierBadge tier={u.tier} />
                    <LayerBadge layer={u.layer} />
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>
                      {u.model}
                    </span>
                    <span
                      style={{
                        color: '#ef4444',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {u.count}×
                    </span>
                    <span style={{ color: '#4b6285', fontSize: 10 }}>
                      {u.lastSeen}
                    </span>
                    <ActionBadge action={u.action} />
                  </div>
                ))}
              </div>
              {alertUser && (
                <div
                  style={{
                    marginTop: 14,
                    padding: '14px',
                    background: '#ef444408',
                    border: '1px solid #ef444430',
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      color: '#ef4444',
                      fontSize: 11,
                      marginBottom: 10,
                      fontWeight: 700,
                    }}
                  >
                    ⚡ ACTIONS → {alertUser}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      'Reset Counters',
                      'Extend Daily Limit',
                      'Downgrade to FREE',
                      'Suspend 1h',
                      'Whitelist',
                    ].map((a) => (
                      <button
                        key={a}
                        onClick={(e) => {
                          e.stopPropagation();
                          alert(`Action "${a}" applied to ${alertUser}`);
                        }}
                        style={{
                          background: '#1a2d45',
                          border: '1px solid #2d4a6a',
                          color: '#94a3b8',
                          padding: '6px 12px',
                          borderRadius: 4,
                          fontSize: 10,
                          cursor: 'pointer',
                          letterSpacing: '0.06em',
                          fontFamily: "'IBM Plex Mono', monospace",
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.borderColor = '#2dd4bf';
                          e.target.style.color = '#2dd4bf';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.borderColor = '#2d4a6a';
                          e.target.style.color = '#94a3b8';
                        }}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Panel title="Violations by Layer">
                {[
                  {
                    layer: 'L1 · Per-Min',
                    count: 30,
                    color: '#2dd4bf',
                    desc: 'Burst abuse',
                  },
                  {
                    layer: 'L2 · Daily',
                    count: 12,
                    color: '#f59e0b',
                    desc: 'Daily spam',
                  },
                  {
                    layer: 'L3 · Monthly',
                    count: 3,
                    color: '#f97316',
                    desc: 'Cost overrun',
                  },
                  {
                    layer: 'L4 · Concurrent',
                    count: 2,
                    color: '#ef4444',
                    desc: 'Session flood',
                  },
                ].map((l) => (
                  <div
                    key={l.layer}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 3,
                        height: 32,
                        background: l.color,
                        borderRadius: 2,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span
                          style={{
                            color: l.color,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {l.layer}
                        </span>
                        <span
                          style={{
                            color: l.color,
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                        >
                          {l.count}
                        </span>
                      </div>
                      <div style={{ color: '#4b6285', fontSize: 10 }}>
                        {l.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </Panel>

              <Panel title="Layer Architecture" badge="3-LAYER">
                {[
                  {
                    l: 'L1',
                    desc: 'Per-minute · Redis 60s TTL',
                    limit: 'FREE 3/min · PRO 10/min',
                    color: '#2dd4bf',
                  },
                  {
                    l: 'L2',
                    desc: 'Daily hard cap · Redis 86400s',
                    limit: 'FREE 20/day · PRO 40/day',
                    color: '#f59e0b',
                  },
                  {
                    l: 'L3',
                    desc: 'Monthly cap · PG + Redis cache',
                    limit: 'PRO only · model-based',
                    color: '#f97316',
                  },
                  {
                    l: 'L4',
                    desc: 'Concurrent sessions · Redis 30s',
                    limit: 'Max 2 parallel',
                    color: '#ef4444',
                  },
                ].map((l) => (
                  <div
                    key={l.l}
                    style={{
                      padding: '8px 0',
                      borderBottom: '1px solid #1a2d4540',
                    }}
                  >
                    <div
                      style={{
                        color: l.color,
                        fontSize: 11,
                        fontWeight: 700,
                        marginBottom: 2,
                      }}
                    >
                      {l.l} — {l.desc}
                    </div>
                    <div style={{ color: '#4b6285', fontSize: 10 }}>
                      {l.limit}
                    </div>
                  </div>
                ))}
              </Panel>
            </div>
          </div>
        )}

        {/* ── CONTROLS TAB ── */}
        {activeTab === 'controls' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 18,
            }}
          >
            <Panel title="FREE Tier Limits" badge="LIVE CONTROLS">
              <ControlSlider
                label="Per-Minute Rate Limit"
                value={controls.freePerMin}
                max={20}
                unit="q/min"
                color="#2dd4bf"
                onChange={(v) => setControls((p) => ({ ...p, freePerMin: v }))}
              />
              <ControlSlider
                label="Daily Hard Cap"
                value={controls.freePerDay}
                max={100}
                unit="q/day"
                color="#2dd4bf"
                onChange={(v) => setControls((p) => ({ ...p, freePerDay: v }))}
              />
              <ControlSlider
                label="Monthly Query Cap"
                value={controls.freePerMonth}
                max={500}
                unit="q/mo"
                color="#2dd4bf"
                onChange={(v) =>
                  setControls((p) => ({ ...p, freePerMonth: v }))
                }
              />
              <div
                style={{
                  marginTop: 12,
                  padding: '10px',
                  background: '#2dd4bf10',
                  border: '1px solid #2dd4bf30',
                  borderRadius: 4,
                }}
              >
                <div
                  style={{ color: '#4b6285', fontSize: 10, marginBottom: 4 }}
                >
                  SaaS COST ESTIMATE
                </div>
                <div
                  style={{ color: '#2dd4bf', fontSize: 16, fontWeight: 700 }}
                >
                  ${(controls.freePerMonth * 0.002).toFixed(2)}
                  <span
                    style={{ color: '#4b6285', fontSize: 11, fontWeight: 400 }}
                  >
                    {' '}
                    / user / mo
                  </span>
                </div>
              </div>
            </Panel>

            <Panel title="PRO Tier Limits" badge="LIVE CONTROLS">
              <ControlSlider
                label="Per-Minute Rate Limit"
                value={controls.proPerMin}
                max={60}
                unit="q/min"
                color="#f59e0b"
                onChange={(v) => setControls((p) => ({ ...p, proPerMin: v }))}
              />
              <ControlSlider
                label="Daily Hard Cap"
                value={controls.proPerDay}
                max={200}
                unit="q/day"
                color="#f59e0b"
                onChange={(v) => setControls((p) => ({ ...p, proPerDay: v }))}
              />
              <ControlSlider
                label="Monthly Query Cap"
                value={controls.proPerMonth}
                max={1000}
                unit="q/mo"
                color="#f59e0b"
                onChange={(v) => setControls((p) => ({ ...p, proPerMonth: v }))}
              />
              <ControlSlider
                label="Cost Cap Per User"
                value={controls.costCap}
                max={50}
                unit="USD/mo"
                color="#f97316"
                onChange={(v) => setControls((p) => ({ ...p, costCap: v }))}
              />
            </Panel>

            <Panel title="Model Access Control" badge="TOGGLE">
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {[
                  {
                    model: 'gemini-2.5-flash',
                    tier: 'FREE',
                    enabled: true,
                    locked: true,
                    cost: '$0.002/q',
                  },
                  {
                    model: 'claude-sonnet-4',
                    tier: 'PRO',
                    enabled: true,
                    locked: false,
                    cost: '$0.066/q',
                  },
                  {
                    model: 'claude-opus-4',
                    tier: 'PRO',
                    enabled: true,
                    locked: false,
                    cost: '$0.330/q',
                  },
                  {
                    model: 'gpt-4o',
                    tier: 'PRO',
                    enabled: true,
                    locked: false,
                    cost: '$0.050/q',
                  },
                  {
                    model: 'gemini-pro',
                    tier: 'PRO',
                    enabled: false,
                    locked: false,
                    cost: '$0.025/q',
                  },
                ].map((m) => (
                  <div
                    key={m.model}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px',
                      background: '#070d16',
                      border: `1px solid ${m.enabled ? '#1a2d45' : '#1a2d4550'}`,
                      borderRadius: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: m.enabled ? '#2dd4bf' : '#1a2d45',
                        boxShadow: m.enabled ? '0 0 6px #2dd4bf' : 'none',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        color: m.enabled ? '#e2e8f0' : '#4b6285',
                        fontSize: 11,
                      }}
                    >
                      {m.model}
                    </span>
                    <TierBadge tier={m.tier} />
                    <span style={{ color: '#4b6285', fontSize: 10 }}>
                      {m.cost}
                    </span>
                    {!m.locked && (
                      <button
                        style={{
                          background: m.enabled ? '#ef444418' : '#2dd4bf18',
                          border: `1px solid ${m.enabled ? '#ef444440' : '#2dd4bf40'}`,
                          color: m.enabled ? '#ef4444' : '#2dd4bf',
                          padding: '3px 8px',
                          borderRadius: 3,
                          fontSize: 9,
                          cursor: 'pointer',
                          fontFamily: "'IBM Plex Mono', monospace",
                          letterSpacing: '0.08em',
                        }}
                      >
                        {m.enabled ? 'DISABLE' : 'ENABLE'}
                      </button>
                    )}
                    {m.locked && (
                      <span
                        style={{
                          color: '#4b6285',
                          fontSize: 9,
                          letterSpacing: '0.08em',
                        }}
                      >
                        LOCKED
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Alert Thresholds"
              badge="NOTIFICATIONS"
              style={{ gridColumn: '1 / -1' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 14,
                }}
              >
                {[
                  {
                    label: 'Cost Alert (daily)',
                    value: '$80',
                    accent: '#f59e0b',
                  },
                  {
                    label: 'Token Spike (15min)',
                    value: '500K',
                    accent: '#2dd4bf',
                  },
                  { label: 'Abuse Events/hr', value: '10', accent: '#ef4444' },
                  {
                    label: 'PRO Budget Alert (%)',
                    value: '80%',
                    accent: '#818cf8',
                  },
                ].map((a) => (
                  <div
                    key={a.label}
                    style={{
                      background: '#070d16',
                      border: '1px solid #1a2d45',
                      borderLeft: `3px solid ${a.accent}`,
                      borderRadius: 4,
                      padding: '12px 14px',
                    }}
                  >
                    <div
                      style={{
                        color: '#4b6285',
                        fontSize: 10,
                        marginBottom: 4,
                      }}
                    >
                      {a.label}
                    </div>
                    <div
                      style={{ color: a.accent, fontSize: 20, fontWeight: 700 }}
                    >
                      {a.value}
                    </div>
                    <div
                      style={{ color: '#4b6285', fontSize: 10, marginTop: 4 }}
                    >
                      ✓ Alert enabled
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div
        style={{
          borderTop: '1px solid #1a2d45',
          padding: '12px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0a0f1a',
        }}
      >
        <span
          style={{ color: '#2d4a6a', fontSize: 10, letterSpacing: '0.1em' }}
        >
          RAG ARCHITECTURE V3.3 · TRADING ADVISORY SYSTEM
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { label: 'PG', status: 'OK', color: '#2dd4bf' },
            { label: 'REDIS', status: 'OK', color: '#2dd4bf' },
            { label: 'VANNA', status: 'OK', color: '#2dd4bf' },
            { label: 'TXTAI', status: 'OK', color: '#2dd4bf' },
            { label: 'LiteLLM', status: 'WARN', color: '#f59e0b' },
          ].map((s) => (
            <div
              key={s.label}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: s.color,
                  boxShadow: `0 0 4px ${s.color}`,
                }}
              />
              <span
                style={{
                  color: '#2d4a6a',
                  fontSize: 9,
                  letterSpacing: '0.1em',
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
