'use client';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface UserGrowthData {
  month: string;
  users: number;
  proUsers: number;
}

export interface RevenueData {
  month: string;
  revenue: number;
  mrr: number;
}

export interface ApiUsageData {
  day: string;
  requests: number;
  errors: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHART STYLES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const chartColors = {
  primary: '#3b82f6', // blue-500
  secondary: '#6366f1', // indigo-500
  success: '#22c55e', // green-500
  warning: '#f59e0b', // amber-500
  error: '#ef4444', // red-500
  muted: '#6b7280', // gray-500
  grid: '#374151', // gray-700
  text: '#9ca3af', // gray-400
};

const tooltipStyle = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#f3f4f6',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER GROWTH CHART
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface UserGrowthChartProps {
  data: UserGrowthData[];
}

export function UserGrowthChart({
  data,
}: UserGrowthChartProps): React.ReactElement {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
        <XAxis dataKey="month" stroke={chartColors.text} fontSize={12} />
        <YAxis stroke={chartColors.text} fontSize={12} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: chartColors.text }}
        />
        <Legend wrapperStyle={{ color: chartColors.text }} />
        <Line
          type="monotone"
          dataKey="users"
          name="Total Users"
          stroke={chartColors.primary}
          strokeWidth={2}
          dot={{ fill: chartColors.primary, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: chartColors.primary }}
        />
        <Line
          type="monotone"
          dataKey="proUsers"
          name="PRO Users"
          stroke={chartColors.success}
          strokeWidth={2}
          dot={{ fill: chartColors.success, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: chartColors.success }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REVENUE CHART
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RevenueChartProps {
  data: RevenueData[];
}

export function RevenueChart({ data }: RevenueChartProps): React.ReactElement {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColors.success} stopOpacity={0.3} />
            <stop offset="95%" stopColor={chartColors.success} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
        <XAxis dataKey="month" stroke={chartColors.text} fontSize={12} />
        <YAxis
          stroke={chartColors.text}
          fontSize={12}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: chartColors.text }}
          formatter={(value) => {
            const numValue = typeof value === 'number' ? value : 0;
            return [`$${numValue.toLocaleString()}`, ''];
          }}
        />
        <Legend wrapperStyle={{ color: chartColors.text }} />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Total Revenue"
          stroke={chartColors.success}
          strokeWidth={2}
          fill="url(#colorRevenue)"
        />
        <Area
          type="monotone"
          dataKey="mrr"
          name="MRR"
          stroke={chartColors.primary}
          strokeWidth={2}
          fill="url(#colorMrr)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API USAGE CHART
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ApiUsageChartProps {
  data: ApiUsageData[];
}

export function ApiUsageChart({
  data,
}: ApiUsageChartProps): React.ReactElement {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
        <XAxis dataKey="day" stroke={chartColors.text} fontSize={12} />
        <YAxis stroke={chartColors.text} fontSize={12} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: chartColors.text }}
        />
        <Legend wrapperStyle={{ color: chartColors.text }} />
        <Bar
          dataKey="requests"
          name="API Requests"
          fill={chartColors.primary}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="errors"
          name="Errors"
          fill={chartColors.error}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SAMPLE DATA GENERATORS (for development/demo)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateSampleUserGrowthData(): UserGrowthData[] {
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let users = 500;
  let proUsers = 50;

  return months.map((month) => {
    users += Math.floor(Math.random() * 100) + 30;
    proUsers += Math.floor(Math.random() * 20) + 5;
    return { month, users, proUsers };
  });
}

export function generateSampleRevenueData(): RevenueData[] {
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let mrr = 2500;
  let revenue = 0;

  return months.map((month) => {
    mrr += Math.floor(Math.random() * 500) + 100;
    revenue += mrr;
    return { month, revenue, mrr };
  });
}

export function generateSampleApiUsageData(): ApiUsageData[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return days.map((day) => ({
    day,
    requests: Math.floor(Math.random() * 5000) + 2000,
    errors: Math.floor(Math.random() * 50) + 5,
  }));
}
