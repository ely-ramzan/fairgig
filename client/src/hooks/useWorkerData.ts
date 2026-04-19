import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { earningsApi, type WorkerSummaryParams, type WorkerTrendsParams } from '../api/earnings';
import { anomalyApi } from '../api/anomaly';

export function usePlatforms() {
  return useQuery({
    queryKey: ['platforms'],
    queryFn: () => earningsApi.getPlatforms().then((r) => r.data),
    staleTime: 1000 * 60 * 60,
  });
}

export function useImportHistory() {
  return useQuery({
    queryKey: ['importHistory'],
    queryFn: () => earningsApi.getImportHistory().then((r) => r.data),
    staleTime: 1000 * 60 * 30,
  });
}

export function useWorkerSummary(workerId: string | undefined, params?: WorkerSummaryParams) {
  return useQuery({
    queryKey: ['workerSummary', workerId, params],
    queryFn: () => earningsApi.getWorkerSummary(workerId!, params).then((r) => r.data),
    enabled: !!workerId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useWorkerTrends(workerId: string | undefined, params?: WorkerTrendsParams) {
  return useQuery({
    queryKey: ['workerTrends', workerId, params],
    queryFn: () => earningsApi.getWorkerTrends(workerId!, params).then((r) => r.data),
    enabled: !!workerId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUploadScreenshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, file }: { shiftId: string; file: File }) =>
      earningsApi.uploadScreenshot(shiftId, file).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      qc.invalidateQueries({ queryKey: ['shift-screenshot', vars.shiftId] });
    },
  });
}

export function useAnalyzeWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => anomalyApi.analyzeWorker().then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anomalies'] });
    },
  });
}
