import { describe, it, expect } from 'vitest';
import { isFinalForNavigation, isFinalForSecurity, getHomePathByRole } from '@/hooks/useAuth';

describe('isFinalForNavigation', () => {
  it('is never final while the role is unknown', () => {
    expect(isFinalForNavigation('unknown', 'db')).toBe(false);
    expect(isFinalForNavigation('unknown', 'jwt-optimistic')).toBe(false);
  });

  it('admin is final ONLY from the db source', () => {
    expect(isFinalForNavigation('admin', 'db')).toBe(true);
    expect(isFinalForNavigation('admin', 'jwt-optimistic')).toBe(false);
    expect(isFinalForNavigation('admin', 'cache')).toBe(false);
    expect(isFinalForNavigation('admin', 'none')).toBe(false);
  });

  it('advisor / bank are final from any non-none source (optimistic included)', () => {
    expect(isFinalForNavigation('advisor', 'jwt-optimistic')).toBe(true);
    expect(isFinalForNavigation('advisor', 'cache')).toBe(true);
    expect(isFinalForNavigation('advisor', 'db')).toBe(true);
    expect(isFinalForNavigation('bank', 'jwt-optimistic')).toBe(true);
    expect(isFinalForNavigation('advisor', 'none')).toBe(false);
  });
});

describe('isFinalForSecurity', () => {
  it('is authoritative only from the db source', () => {
    expect(isFinalForSecurity('db')).toBe(true);
    expect(isFinalForSecurity('jwt-optimistic')).toBe(false);
    expect(isFinalForSecurity('cache')).toBe(false);
    expect(isFinalForSecurity('none')).toBe(false);
  });
});

describe('getHomePathByRole', () => {
  it('routes each role to its dashboard', () => {
    expect(getHomePathByRole('admin')).toBe('/admin/dashboard');
    expect(getHomePathByRole('bank')).toBe('/bank/dashboard');
    expect(getHomePathByRole('advisor')).toBe('/advisor/dashboard');
  });

  it('falls back to root for an unknown role', () => {
    expect(getHomePathByRole('unknown')).toBe('/');
  });
});
