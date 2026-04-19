import { anomalyClient } from './client';
import type { AnomalyResult, DetectResponse, ShiftInput } from '../types/api';

export const anomalyApi = {
  detect: (earnings: ShiftInput[], signal?: AbortSignal) =>
    anomalyClient.post<DetectResponse>('/api/anomaly/detect', { earnings }, { signal }),

  analyzeWorker: (signal?: AbortSignal) =>
    anomalyClient.post<{ anomalies_cached: number; anomalies: unknown[] }>(
      '/api/anomaly/analyze-worker',
      {},
      { signal },
    ),

  getWorkerAnomalies: (workerId: string, params?: { severity?: string }, signal?: AbortSignal) =>
    anomalyClient.get<AnomalyResult[]>(`/api/anomaly/results/${workerId}`, { params, signal }),
};
