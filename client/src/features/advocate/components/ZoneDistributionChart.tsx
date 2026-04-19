import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme }          from '../../../theme/ThemeContext';
import { formatCompactPKR }  from '../../../lib/formatting';
import type { ZoneDistributionPoint } from '../../../types/charts';

interface ZoneDistributionChartProps {
  data: ZoneDistributionPoint[];
}

export function ZoneDistributionChart({ data }: ZoneDistributionChartProps) {
  const { colors } = useTheme();

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
        <XAxis
          dataKey="zone_name"
          tick={{ fontFamily: 'var(--fg-font-mono)', fontSize: 9, fill: colors.t3 }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tickFormatter={formatCompactPKR}
          tick={{ fontFamily: 'var(--fg-font-mono)', fontSize: 9, fill: colors.t3 }}
          axisLine={false} tickLine={false} width={60}
        />
        <Tooltip
          contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6, fontFamily: 'var(--fg-font-mono)', fontSize: 11 }}
          formatter={(value) => [formatCompactPKR(Number(value)), '']}
          labelStyle={{ color: colors.t2 }}
        />
        <Bar dataKey="median_net" fill={colors.jade} radius={[2, 2, 0, 0]} maxBarSize={32} name="Median net" />
      </BarChart>
    </ResponsiveContainer>
  );
}
