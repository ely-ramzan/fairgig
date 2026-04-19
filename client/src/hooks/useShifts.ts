import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { earningsApi, type ListShiftsParams } from '../api/earnings';
import type { ShiftCreatePayload } from '../types/api';

export function useShifts(params?: ListShiftsParams) {
  return useQuery({
    queryKey: ['shifts', params],
    queryFn: () => earningsApi.listShifts(params).then((r) => r.data),
  });
}

export function useShift(id: string) {
  return useQuery({
    queryKey: ['shifts', id],
    queryFn: () => earningsApi.getShift(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ShiftCreatePayload) => earningsApi.createShift(payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      qc.invalidateQueries({ queryKey: ['workerSummary'] });
      qc.invalidateQueries({ queryKey: ['workerTrends'] });
    },
  });
}

export function useImportCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => earningsApi.importCsv(formData).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      qc.invalidateQueries({ queryKey: ['importHistory'] });
    },
  });
}
