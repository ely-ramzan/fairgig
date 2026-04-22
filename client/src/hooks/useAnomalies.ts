import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { anomalyApi }  from '../api/anomaly';
import type { ShiftInput } from '../types/api';

export function useAnomalies(workerId: string) {
  return useQuery({
    queryKey: ['anomalies', workerId],
    queryFn:  () => anomalyApi.getWorkerAnomalies(workerId).then((r) => r.data),
    enabled:  !!workerId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useDetectAnomalies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shifts: ShiftInput[]) =>
      anomalyApi.detect(shifts).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['anomalies'] }); },
  });
}
