import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useTheme }   from '../../../theme/ThemeContext';
import { formatPercent } from '../../../lib/formatting';

interface CommissionTrendsChartProps {
  data: Array<{ date: string; [platform: string]: string | number }>;
  platforms: string[];
}

const PLATFORM_COLORS = ['#D4900E', '#3D8C6E', '#3A6F96', '#B83820', '#9A9890'];

export function CommissionTrendsChart({ data, platforms }: CommissionTrendsChartProps) {
  const { colors } = useTheme();

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontFamily: 'var(--fg-font-mono)', fontSize: 9, fill: colors.t3 }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fontFamily: 'var(--fg-font-mono)', fontSize: 9, fill: colors.t3 }}
          axisLine={false} tickLine={false} width={36}
        />
        <Tooltip
          contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6, fontFamily: 'var(--fg-font-mono)', fontSize: 11 }}
          formatter={(value) => [formatPercent(Number(value)), '']}
          labelStyle={{ color: colors.t2 }}
        />
        <Legend
          iconSize={8}
          wrapperStyle={{ fontFamily: 'var(--fg-font-mono)', fontSize: 10, color: colors.t2 }}
        />
        {platforms.map((p, i) => (
          <Line
            key={p}
            type="monotone"
            dataKey={p}
            stroke={PLATFORM_COLORS[i % PLATFORM_COLORS.length]}
            strokeWidth={1.5}
            dot={false}
            name={p}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
