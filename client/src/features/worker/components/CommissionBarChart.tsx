import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useTheme } from '../../../theme/ThemeContext';
import type { CommissionPoint } from '../../../types/charts';
import { formatPercent } from '../../../lib/formatting';

interface CommissionBarChartProps {
  data: CommissionPoint[];
}

export function CommissionBarChart({ data }: CommissionBarChartProps) {
  const { colors } = useTheme();

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontFamily: 'var(--fg-font-mono)', fontSize: 9, fill: colors.t3 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fontFamily: 'var(--fg-font-mono)', fontSize: 9, fill: colors.t3 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6, fontFamily: 'var(--fg-font-mono)', fontSize: 11 }}
          formatter={(value) => [formatPercent(Number(value)), 'Commission']}
          labelStyle={{ color: colors.t2 }}
        />
        {/* Reference line at 25% — typical upper normal rate */}
        <ReferenceLine y={25} stroke={colors.amber} strokeDasharray="4 4" strokeWidth={1} />
        <Bar dataKey="commission_rate" fill={colors.amber} radius={[2, 2, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
