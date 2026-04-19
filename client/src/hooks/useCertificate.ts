import { useQuery, useMutation } from '@tanstack/react-query';
import { certificateApi, type CertificateDateParams } from '../api/certificate';

export function useCertificatePreview(params: CertificateDateParams | null) {
  return useQuery({
    queryKey: ['certificate', 'preview', params],
    queryFn: () => certificateApi.preview(params!).then((r) => r.data),
    enabled: !!params?.date_from && !!params?.date_to,
    staleTime: 1000 * 60,
  });
}

export function useCertificateGenerateMutation() {
  return useMutation({
    mutationFn: (params: CertificateDateParams) => certificateApi.generate(params).then((r) => r.data),
  });
}
