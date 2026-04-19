import { useQuery } from '@tanstack/react-query';
import { earningsApi } from '../api/earnings';

export function useEarnings(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['earnings', params],
    queryFn: () =>
      earningsApi.listShifts({ ...params, limit: params?.limit ?? 500, page: params?.page ?? 1 }).then((r) => r.data.items),
    select: (shifts) => {
      const totalGross = shifts.reduce((s, sh) => s + sh.gross_earned, 0);
      const totalNet = shifts.reduce((s, sh) => s + sh.net_received, 0);
      const totalHours = shifts.reduce((s, sh) => s + sh.hours_worked, 0);
      const avgRate = totalGross > 0 ? ((totalGross - totalNet) / totalGross) * 100 : 0;
      const hourlyRate = totalHours > 0 ? totalNet / totalHours : 0;
      return { shifts, totalGross, totalNet, totalHours, avgRate, hourlyRate };
    },
  });
}
