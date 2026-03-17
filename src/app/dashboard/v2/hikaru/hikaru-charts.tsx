'use client';

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// ChartSpec — the JSON schema the AI emits inside :::chart blocks
// ---------------------------------------------------------------------------
export type ChartSpec = {
  type: 'bar' | 'pie' | 'area' | 'horizontal-bar';
  title: string;
  data: { name: string; value: number; [key: string]: unknown }[];
  keys?: string[]; // for multi-series bar/area
  colors?: string[]; // override default palette
  xKey?: string; // default: 'name'
  valueFormatter?: 'number' | 'reach' | 'percent';
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_COLORS = ['#1235e2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ---------------------------------------------------------------------------
// Value formatter
// ---------------------------------------------------------------------------
function formatValue(
  value: number,
  formatter?: 'number' | 'reach' | 'percent'
): string {
  switch (formatter) {
    case 'reach': {
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
      return value.toLocaleString();
    }
    case 'percent':
      return `${value}%`;
    default:
      return value.toLocaleString();
  }
}

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------
function gridStroke(darkMode: boolean) {
  return darkMode ? '#1e293b' : '#e2e8f0';
}

function axisTick(darkMode: boolean) {
  return { fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' };
}

function tooltipStyle(darkMode: boolean) {
  return {
    backgroundColor: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 8,
    color: darkMode ? '#e2e8f0' : '#1e293b',
  };
}

function containerClass(darkMode: boolean) {
  return `rounded-xl border p-4 my-3 ${
    darkMode
      ? 'bg-[#1235e2]/5 border-[#1235e2]/10'
      : 'bg-white border-slate-200'
  }`;
}

// ---------------------------------------------------------------------------
// Bar Chart (vertical)
// ---------------------------------------------------------------------------
function HikaruBarChart({
  spec,
  darkMode,
}: {
  spec: ChartSpec;
  darkMode: boolean;
}) {
  const keys = spec.keys || ['value'];
  const colors = spec.colors || DEFAULT_COLORS;
  const xKey = spec.xKey || 'name';

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={spec.data}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(darkMode)} />
        <XAxis dataKey={xKey} tick={axisTick(darkMode)} />
        <YAxis tick={axisTick(darkMode)} />
        <Tooltip
          contentStyle={tooltipStyle(darkMode)}
          formatter={(value: number | undefined) => formatValue(value ?? 0, spec.valueFormatter)}
        />
        {keys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[i % colors.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Pie Chart (donut)
// ---------------------------------------------------------------------------
function HikaruPieChart({
  spec,
  darkMode,
}: {
  spec: ChartSpec;
  darkMode: boolean;
}) {
  const colors = spec.colors || DEFAULT_COLORS;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={spec.data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {spec.data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={colors[index % colors.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle(darkMode)}
          formatter={(value: number | undefined) => formatValue(value ?? 0, spec.valueFormatter)}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Area Chart
// ---------------------------------------------------------------------------
function HikaruAreaChart({
  spec,
  darkMode,
}: {
  spec: ChartSpec;
  darkMode: boolean;
}) {
  const keys = spec.keys || ['value'];
  const colors = spec.colors || DEFAULT_COLORS;
  const xKey = spec.xKey || 'name';

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={spec.data}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(darkMode)} />
        <XAxis dataKey={xKey} tick={axisTick(darkMode)} />
        <YAxis tick={axisTick(darkMode)} />
        <Tooltip
          contentStyle={tooltipStyle(darkMode)}
          formatter={(value: number | undefined) => formatValue(value ?? 0, spec.valueFormatter)}
        />
        {keys.map((key, i) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[i % colors.length]}
            fill={colors[i % colors.length]}
            fillOpacity={0.15}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Horizontal Bar Chart
// ---------------------------------------------------------------------------
function HikaruHorizontalBarChart({
  spec,
  darkMode,
}: {
  spec: ChartSpec;
  darkMode: boolean;
}) {
  const keys = spec.keys || ['value'];
  const colors = spec.colors || DEFAULT_COLORS;
  const xKey = spec.xKey || 'name';

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={spec.data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(darkMode)} />
        <XAxis type="number" tick={axisTick(darkMode)} />
        <YAxis
          type="category"
          dataKey={xKey}
          tick={axisTick(darkMode)}
          width={100}
        />
        <Tooltip
          contentStyle={tooltipStyle(darkMode)}
          formatter={(value: number | undefined) => formatValue(value ?? 0, spec.valueFormatter)}
        />
        {keys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[i % colors.length]}
            radius={[0, 4, 4, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// HikaruChart — main export, dispatches to the correct chart type
// ---------------------------------------------------------------------------
export function HikaruChart({
  spec,
  darkMode,
}: {
  spec: ChartSpec;
  darkMode: boolean;
}) {
  const ChartComponent = (() => {
    switch (spec.type) {
      case 'bar':
        return HikaruBarChart;
      case 'pie':
        return HikaruPieChart;
      case 'area':
        return HikaruAreaChart;
      case 'horizontal-bar':
        return HikaruHorizontalBarChart;
      default:
        return null;
    }
  })();

  if (!ChartComponent) return null;

  return (
    <div className={containerClass(darkMode)}>
      <h4 className="text-sm font-semibold mb-3">{spec.title}</h4>
      <ChartComponent spec={spec} darkMode={darkMode} />
      <p className="text-[10px] mt-2 opacity-50">Data from AI analysis</p>
    </div>
  );
}
