import { describe, it, expect } from 'vitest';
import {
  regionLabel,
  propertyTypeLabel,
  borrowerTypeLabel,
  appetiteLevelLabel,
  regionsLabel,
  borrowerTypesLabel,
} from '@/lib/labels';

describe('labels', () => {
  it('translates known values to Hebrew', () => {
    expect(regionLabel('center')).toBe('מרכז');
    expect(regionLabel('jerusalem')).toBe('ירושלים');
    expect(propertyTypeLabel('apartment')).toBe('דירה');
    expect(borrowerTypeLabel('employee')).toBe('שכיר');
    expect(borrowerTypeLabel('self_employed')).toBe('עצמאי');
    expect(appetiteLevelLabel('high')).toBe('גבוה');
  });

  it('falls back to the raw value when the key is unknown', () => {
    // 'other' exists in the DB but not in the options list — must pass through
    expect(regionLabel('other')).toBe('other');
    expect(appetiteLevelLabel('extreme')).toBe('extreme');
  });

  it('returns an empty string for null / undefined', () => {
    expect(regionLabel(null)).toBe('');
    expect(regionLabel(undefined)).toBe('');
    expect(borrowerTypeLabel(null)).toBe('');
  });

  it('joins lists into a Hebrew comma-separated string', () => {
    expect(regionsLabel(['center', 'north'])).toBe('מרכז, צפון');
    expect(borrowerTypesLabel(['employee', 'self_employed'])).toBe('שכיר, עצמאי');
  });

  it('returns an empty string for an empty or missing list', () => {
    expect(regionsLabel([])).toBe('');
    expect(regionsLabel(null)).toBe('');
    expect(borrowerTypesLabel(undefined)).toBe('');
  });
});
