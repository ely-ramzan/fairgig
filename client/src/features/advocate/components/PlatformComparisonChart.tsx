import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../../theme/ThemeContext';
import type { PlatformComparisonRow } from '../../../types/api';
import { formatPercent } from '../../../lib/formatting';

export function PlatformComparisonChart({ data }: { data: PlatformComparisonRow[] }) {
  const { colors } = useTheme();
  const chartData = data.map((r) => ({
    name: r.platform_name,
    commission: r.avg_commission_rate,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: colors.t3 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => formatPercent(Number(v))}
          tick={{ fontSize: 9, fill: colors.t3 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}` }}
          formatter={(value) => [formatPercent(Number(value)), 'Avg commission']}
        />
        <Bar dataKey="commission" fill={colors.amber} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
