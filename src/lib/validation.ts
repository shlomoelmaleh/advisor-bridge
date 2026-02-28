import { z } from 'zod';

export const caseSchema = z.object({
  loan_amount_min: z.number().int().min(50000, 'סכום מינימום: ₪50,000').max(10000000, 'סכום מקסימום: ₪10,000,000'),
  loan_amount_max: z.number().int().min(50000, 'סכום מינימום: ₪50,000').max(10000000, 'סכום מקסימום: ₪10,000,000'),
  ltv: z.number().int().min(20, 'LTV מינימום: 20%').max(95, 'LTV מקסימום: 95%'),
  borrower_type: z.enum(['employee', 'self_employed']),
  property_type: z.string().min(1).max(100),
  region: z.string().min(1).max(100),
  priorities: z.object({
    speed: z.boolean(),
    rate: z.boolean(),
    ltv: z.boolean(),
  }),
  is_anonymous: z.boolean().optional(),
}).refine(data => data.loan_amount_min <= data.loan_amount_max, {
  message: 'סכום מינימלי לא יכול להיות גדול ממקסימלי',
  path: ['loan_amount_min'],
});

export const messageSchema = z.object({
  content: z.string().trim().min(1, 'הודעה לא יכולה להיות ריקה').max(10000, 'הודעה ארוכה מדי (מקסימום 10,000 תווים)'),
});

export const appetiteSchema = z.object({
  bank_name: z.string().min(1, 'שם בנק נדרש').max(200),
  branch_name: z.string().max(200).optional().nullable(),
  appetite_level: z.enum(['high', 'medium', 'low']),
  min_loan_amount: z.number().int().min(0).max(10000000),
  max_ltv: z.number().int().min(1).max(100),
  preferred_borrower_types: z.array(z.string()),
  preferred_regions: z.array(z.string()),
  sla_days: z.number().int().min(1).max(365),
  valid_until: z.string(),
  is_approved: z.boolean().optional(),
});
