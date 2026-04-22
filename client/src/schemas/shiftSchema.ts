import { z } from 'zod';

export const shiftSchema = z
  .object({
    platform_id: z.string().uuid('Select a platform'),
    shift_date: z.string().min(1, 'Date is required').refine(
      (v) => v <= new Date().toISOString().split('T')[0],
      'Date cannot be in the future',
    ),
    hours_worked: z
      .number('Must be a number')
      .positive('Hours must be greater than 0')
      .max(24, 'Cannot exceed 24 hours in a single shift'),
    gross_earned: z.number('Must be a number').positive('Gross earnings must be greater than 0'),
    platform_deductions: z.number('Must be a number').min(0, 'Deductions cannot be negative'),
    net_received: z.number('Must be a number').positive('Net received must be greater than 0'),
  })
  .refine((data) => data.platform_deductions <= data.gross_earned, {
    message: 'Platform deductions cannot exceed gross earned',
    path: ['platform_deductions'],
  })
  .refine((data) => data.net_received <= data.gross_earned, {
    message: 'Net received cannot exceed gross earned',
    path: ['net_received'],
  })
  .refine(
    (data) => {
      const expected = data.gross_earned - data.platform_deductions;
      if (expected <= 0) return true;
      const tolerance = expected * 0.02;
      return Math.abs(data.net_received - expected) <= tolerance;
    },
    {
      message: 'Net must be within 2% of (gross − deductions)',
      path: ['net_received'],
    },
  );

export type ShiftFormValues = z.infer<typeof shiftSchema>;
