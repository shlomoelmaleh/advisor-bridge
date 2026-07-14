import { describe, it, expect } from 'vitest';
import { caseSchema, messageSchema, appetiteSchema } from '@/lib/validation';

const validCase = {
  loan_amount_min: 500000,
  loan_amount_max: 800000,
  ltv: 60,
  borrower_type: 'employee' as const,
  property_type: 'apartment',
  region: 'center',
  priorities: { speed: true, rate: false, ltv: false },
  is_anonymous: true,
};

describe('caseSchema', () => {
  it('accepts a well-formed case', () => {
    expect(caseSchema.safeParse(validCase).success).toBe(true);
  });

  it('rejects when min loan is greater than max loan', () => {
    const r = caseSchema.safeParse({ ...validCase, loan_amount_min: 900000, loan_amount_max: 800000 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some(i => i.path.includes('loan_amount_min'))).toBe(true);
    }
  });

  it('enforces LTV bounds (20-95)', () => {
    expect(caseSchema.safeParse({ ...validCase, ltv: 10 }).success).toBe(false);
    expect(caseSchema.safeParse({ ...validCase, ltv: 99 }).success).toBe(false);
  });

  it('rejects an unknown borrower_type', () => {
    expect(caseSchema.safeParse({ ...validCase, borrower_type: 'student' }).success).toBe(false);
  });
});

describe('messageSchema', () => {
  it('accepts a normal message', () => {
    expect(messageSchema.safeParse({ content: 'שלום' }).success).toBe(true);
  });

  it('rejects empty or whitespace-only content', () => {
    expect(messageSchema.safeParse({ content: '' }).success).toBe(false);
    expect(messageSchema.safeParse({ content: '   ' }).success).toBe(false);
  });

  it('rejects content over 10,000 characters', () => {
    expect(messageSchema.safeParse({ content: 'a'.repeat(10001) }).success).toBe(false);
  });
});

describe('appetiteSchema', () => {
  const validAppetite = {
    bank_name: 'בנק לדוגמה',
    branch_name: 'סניף ראשי',
    appetite_level: 'high' as const,
    min_loan_amount: 100000,
    max_ltv: 75,
    preferred_borrower_types: ['employee'],
    preferred_regions: ['center'],
    sla_days: 14,
    valid_until: '2026-12-31',
  };

  it('accepts a well-formed appetite', () => {
    expect(appetiteSchema.safeParse(validAppetite).success).toBe(true);
  });

  it('rejects an invalid appetite_level', () => {
    expect(appetiteSchema.safeParse({ ...validAppetite, appetite_level: 'huge' }).success).toBe(false);
  });

  it('enforces max_ltv lower bound (>= 1)', () => {
    expect(appetiteSchema.safeParse({ ...validAppetite, max_ltv: 0 }).success).toBe(false);
  });
});
