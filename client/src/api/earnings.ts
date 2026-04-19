import { earningsClient } from './client';
import type {
  CsvImportResponse,
  ImportRecord,
  PaginatedResponse,
  Platform,
  Shift,
  ShiftCreatePayload,
  VerificationPayload,
  WorkerSummary,
  WorkerTrends,
} from '../types/api';

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type ListShiftsParams = {
  page?: number;
  limit?: number;
  platform_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
};

export type WorkerSummaryParams = { date_from?: string; date_to?: string };
export type WorkerTrendsParams = { months?: number };

function assertFileSize(file: File, maxBytes: number, label: string): void {
  if (file.size > maxBytes) {
    throw new Error(`${label} must be at most ${maxBytes / (1024 * 1024)} MB`);
  }
}

export const earningsApi = {
  listShifts: (params?: ListShiftsParams, signal?: AbortSignal) =>
    earningsClient.get<PaginatedResponse<Shift>>('/api/earnings/shifts', { params, signal }),

  getShift: (id: string, signal?: AbortSignal) =>
    earningsClient.get<Shift>(`/api/earnings/shifts/${id}`, { signal }),

  createShift: (payload: ShiftCreatePayload, signal?: AbortSignal) =>
    earningsClient.post<Shift>('/api/earnings/shifts', payload, { signal }),

  importCsv: (formData: FormData, signal?: AbortSignal) => {
    const file = formData.get('file');
    if (file instanceof File) assertFileSize(file, MAX_IMPORT_BYTES, 'Import file');
    return earningsClient.post<CsvImportResponse>('/api/earnings/shifts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
    });
  },

  getPlatforms: (signal?: AbortSignal) =>
    earningsClient.get<Platform[]>('/api/earnings/platforms', { signal }),

  getImportHistory: (signal?: AbortSignal) =>
    earningsClient.get<ImportRecord[]>('/api/earnings/imports', { signal }),

  getWorkerSummary: (workerId: string, params?: WorkerSummaryParams, signal?: AbortSignal) =>
    earningsClient.get<WorkerSummary>(`/api/earnings/worker/${workerId}/summary`, { params, signal }),

  getWorkerTrends: (workerId: string, params?: WorkerTrendsParams, signal?: AbortSignal) =>
    earningsClient.get<WorkerTrends>(`/api/earnings/worker/${workerId}/trends`, { params, signal }),

  uploadScreenshot: (
    shiftId: string,
    file: File,
    opts?: { onUploadProgress?: (p: number) => void; signal?: AbortSignal },
  ) => {
    assertFileSize(file, MAX_SCREENSHOT_BYTES, 'Screenshot');
    const formData = new FormData();
    formData.append('file', file);
    return earningsClient.post(`/api/earnings/shifts/${shiftId}/screenshot`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: opts?.onUploadProgress
        ? (e) => {
            if (e.total) opts.onUploadProgress!(Math.round((e.loaded / e.total) * 100));
          }
        : undefined,
      signal: opts?.signal,
    });
  },

  getScreenshot: (shiftId: string, thumbnail?: boolean, signal?: AbortSignal) =>
    earningsClient.get<{ url: string; original_filename: string | null }>(
      `/api/earnings/shifts/${shiftId}/screenshot`,
      { params: thumbnail ? { thumbnail: true } : undefined, signal },
    ),

  verificationQueue: (params?: { page?: number; limit?: number }, signal?: AbortSignal) =>
    earningsClient.get<PaginatedResponse<Shift>>('/api/earnings/verification-queue', { params, signal }),

  submitVerification: (shiftId: string, payload: VerificationPayload, signal?: AbortSignal) =>
    earningsClient.post<Shift>(`/api/earnings/shifts/${shiftId}/verify`, payload, { signal }),
};
