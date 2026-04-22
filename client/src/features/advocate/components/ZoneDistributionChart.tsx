import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
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
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
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
            formatter={(value, name) => [formatCompactPKR(Number(value)), name]}
            labelStyle={{ color: colors.t2, marginBottom: 4 }}
          />
          <Legend
            wrapperStyle={{ fontFamily: 'var(--fg-font-mono)', fontSize: 10, color: colors.t2 }}
            iconSize={8}
          />
          <Bar dataKey="p25_net"    name="P25 net"    fill={colors.border}  radius={[2, 2, 0, 0]} maxBarSize={20} />
          <Bar dataKey="median_net" name="Median net" fill={colors.jade}    radius={[2, 2, 0, 0]} maxBarSize={20} />
          <Bar dataKey="p75_net"    name="P75 net"    fill={colors.amber}   radius={[2, 2, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>

      {/* Worker count per zone */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-1">
        {data.map((z) => (
          <span key={z.zone_name} className="font-mono text-[9px] text-t4">
            {z.zone_name} <span className="text-t2">{z.worker_count} workers</span>
          </span>
        ))}
      </div>
    </div>
  );
}
