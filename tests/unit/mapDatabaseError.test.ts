import { describe, it, expect } from 'vitest';
import { mapDatabaseError } from '@/lib/mapDatabaseError';

const GENERIC = 'אירעה שגיאה. נסה שוב או פנה לתמיכה.';
const NO_PERMISSION = 'אין לך הרשאה לבצע פעולה זו';

describe('mapDatabaseError', () => {
  it('returns the generic message for null / non-object input', () => {
    expect(mapDatabaseError(null)).toBe(GENERIC);
    expect(mapDatabaseError(undefined)).toBe(GENERIC);
    expect(mapDatabaseError('boom')).toBe(GENERIC);
    expect(mapDatabaseError(42)).toBe(GENERIC);
  });

  it('maps known Postgres error codes', () => {
    expect(mapDatabaseError({ code: '23505' })).toBe('רשומה זו כבר קיימת');
    expect(mapDatabaseError({ code: '23503' })).toBe('הפניה לנתונים לא תקינה');
    expect(mapDatabaseError({ code: '23514' })).toBe('הנתונים שהוזנו אינם תקינים');
  });

  it('maps RLS violations to a permission message', () => {
    expect(mapDatabaseError({ message: 'new row violates row-level security policy' }))
      .toBe(NO_PERMISSION);
    expect(mapDatabaseError({ message: 'Unauthorized: only advisors can run matching' }))
      .toBe(NO_PERMISSION);
  });

  it('maps rate-limit exceptions raised by the DB triggers', () => {
    expect(mapDatabaseError({ message: 'Please wait a moment before updating this match again' }))
      .toBe('נא להמתין לפני הפעלה חוזרת');
    expect(mapDatabaseError({ message: 'Too many updates in a short time, please try again in a minute' }))
      .toBe('בוצעו יותר מדי עדכונים בזמן קצר. נסו שוב עוד דקה.');
  });

  it('prefers the error code over the message when both are present', () => {
    expect(mapDatabaseError({ code: '23505', message: 'row-level security' }))
      .toBe('רשומה זו כבר קיימת');
  });

  it('falls back to the generic message for an unrecognized error', () => {
    expect(mapDatabaseError({ code: 'XX999', message: 'something obscure' })).toBe(GENERIC);
  });
});
