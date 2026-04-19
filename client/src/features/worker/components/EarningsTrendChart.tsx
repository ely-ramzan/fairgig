import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../../../theme/ThemeContext';
import type { EarningsTrendPoint } from '../../../types/charts';
import { formatCompactPKR } from '../../../lib/formatting';

interface EarningsTrendChartProps {
  data: EarningsTrendPoint[];
}

export function EarningsTrendChart({ data }: EarningsTrendChartProps) {
  const { colors } = useTheme();

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontFamily: 'var(--fg-font-mono)', fontSize: 9, fill: colors.t3 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatCompactPKR}
          tick={{ fontFamily: 'var(--fg-font-mono)', fontSize: 9, fill: colors.t3 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6, fontFamily: 'var(--fg-font-mono)', fontSize: 11 }}
          formatter={(value) => [formatCompactPKR(Number(value)), '']}
          labelStyle={{ color: colors.t2 }}
        />
        <Line
          type="monotone"
          dataKey="net_received"
          stroke={colors.jade}
          strokeWidth={1.5}
          dot={false}
          name="Net income"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
