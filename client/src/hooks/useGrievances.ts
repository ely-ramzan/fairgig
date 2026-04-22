import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { grievanceApi, type GrievanceListParams } from '../api/grievance';
import type { GrievanceCreatePayload, GrievanceStatusPayload } from '../types/api';

export function useGrievances(params?: GrievanceListParams) {
  return useQuery({
    queryKey: ['grievances', params],
    queryFn: () => grievanceApi.list(params).then((r) => r.data),
  });
}

export function useGrievanceClusters(params?: { days?: number; min_cluster_size?: number }) {
  return useQuery({
    queryKey: ['grievances', 'clusters', params],
    queryFn: () => grievanceApi.getClusters(params).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useGrievanceStats() {
  return useQuery({
    queryKey: ['grievances', 'stats'],
    queryFn: () => grievanceApi.getStats().then((r) => r.data),
  });
}

export function useCreateGrievance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GrievanceCreatePayload) => grievanceApi.create(payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
    },
  });
}

export function useUpdateGrievanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GrievanceStatusPayload }) =>
      grievanceApi.updateStatus(id, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
    },
  });
}

export function useDeleteGrievance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => grievanceApi.deleteGrievance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
    },
  });
}

export function useAddGrievanceTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) => grievanceApi.addTag(id, tag),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
    },
  });
}

export function useRemoveGrievanceTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) => grievanceApi.removeTag(id, tag),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
    },
  });
}
