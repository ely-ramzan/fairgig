import { certificateClient } from './client';
import type { CertificatePreview } from '../types/api';

export type CertificateDateParams = {
  date_from: string;
  date_to: string;
};

export const certificateApi = {
  preview: (params: CertificateDateParams, signal?: AbortSignal) =>
    certificateClient.get<CertificatePreview>('/api/certificate/preview', { params, signal }),

  generate: (params: CertificateDateParams, signal?: AbortSignal) =>
    certificateClient.get<string>('/api/certificate/generate', {
      params,
      responseType: 'text',
      signal,
    }),
};
