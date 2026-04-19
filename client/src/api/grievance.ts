import { grievanceClient } from './client';
import type {
  Grievance,
  GrievanceCluster,
  GrievanceCreatePayload,
  GrievanceStats,
  GrievanceStatusPayload,
  PaginatedResponse,
} from '../types/api';

export type GrievanceListParams = {
  page?: number;
  limit?: number;
  platform_id?: string;
  category?: string;
  status?: string;
  tag?: string;
};

export const grievanceApi = {
  list: (params?: GrievanceListParams, signal?: AbortSignal) =>
    grievanceClient.get<PaginatedResponse<Grievance>>('/api/grievances', { params, signal }),

  get: (id: string, signal?: AbortSignal) =>
    grievanceClient.get<Grievance>(`/api/grievances/${id}`, { signal }),

  create: (payload: GrievanceCreatePayload, signal?: AbortSignal) =>
    grievanceClient.post<Grievance>('/api/grievances', payload, { signal }),

  updateStatus: (id: string, payload: GrievanceStatusPayload, signal?: AbortSignal) =>
    grievanceClient.patch<Grievance>(`/api/grievances/${id}/status`, payload, { signal }),

  deleteGrievance: (id: string, signal?: AbortSignal) =>
    grievanceClient.delete(`/api/grievances/${id}`, { signal }),

  getStats: (signal?: AbortSignal) =>
    grievanceClient.get<GrievanceStats>('/api/grievances/stats', { signal }),

  getClusters: (params?: { days?: number; min_cluster_size?: number }, signal?: AbortSignal) =>
    grievanceClient.get<GrievanceCluster[]>('/api/grievances/clusters', { params, signal }),

  addTag: (id: string, tag: string, signal?: AbortSignal) =>
    grievanceClient.post(`/api/grievances/${id}/tags`, { tag }, { signal }),

  removeTag: (id: string, tag: string, signal?: AbortSignal) =>
    grievanceClient.delete(`/api/grievances/${id}/tags/${encodeURIComponent(tag)}`, { signal }),
};
