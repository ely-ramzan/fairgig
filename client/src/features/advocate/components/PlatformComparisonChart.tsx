import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTheme } from '../../../theme/ThemeContext';
import type { PlatformComparisonRow } from '../../../types/api';
import { formatPercent } from '../../../lib/formatting';

export function PlatformComparisonChart({ data }: { data: PlatformComparisonRow[] }) {
  const { colors } = useTheme();
  const chartData = data.map((r) => ({
    name:        r.platform_name,
    commission:  r.avg_commission_rate,
    fairness:    r.fairness_score,
  }));
  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: colors.t3 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: colors.t3 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, fontFamily: 'var(--fg-font-mono)', fontSize: 11 }}
            formatter={(value, name) =>
              name === 'Commission %'
                ? [formatPercent(Number(value)), name]
                : [`${Number(value).toFixed(1)} / 100`, name]
            }
            labelStyle={{ color: colors.t2 }}
          />
          <Legend wrapperStyle={{ fontFamily: 'var(--fg-font-mono)', fontSize: 10, color: colors.t2 }} iconSize={8} />
          <Bar dataKey="commission" name="Commission %" fill={colors.amber} maxBarSize={24} />
          <Bar dataKey="fairness"   name="Fairness score" fill={colors.jade}  maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>

      {/* Complaint & deactivation summary table */}
      <table className="w-full border-t border-border font-mono text-[10px] text-t2">
        <thead>
          <tr className="text-t4">
            <th className="text-left py-1.5 font-normal">Platform</th>
            <th className="text-right py-1.5 font-normal">Complaints</th>
            <th className="text-right py-1.5 font-normal">Deactivations</th>
            <th className="text-right py-1.5 font-normal">Avg hourly</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.platform_name} className="border-t border-border/60">
              <td className="py-1.5 text-t1">{r.platform_name}</td>
              <td className={`py-1.5 text-right ${r.complaint_count > 5 ? 'text-rust' : ''}`}>
                {r.complaint_count}
              </td>
              <td className={`py-1.5 text-right ${r.deactivation_complaints > 2 ? 'text-rust' : ''}`}>
                {r.deactivation_complaints}
              </td>
              <td className="py-1.5 text-right">PKR {r.avg_hourly_rate.toFixed(0)}/h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
