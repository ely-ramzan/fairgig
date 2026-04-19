import { z } from 'zod';

const ALLOWED_TYPES = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const csvImportSchema = z.object({
  file: z
    .instanceof(File, { message: 'Please select a file' })
    .refine((f) => ALLOWED_TYPES.includes(f.type), 'Only CSV, XLS, and XLSX files are accepted')
    .refine((f) => f.size <= MAX_SIZE_BYTES, 'File must be smaller than 10 MB'),
  platform_id: z.string().uuid('Select a platform').optional(),
});

export type CsvImportFormValues = z.infer<typeof csvImportSchema>;
