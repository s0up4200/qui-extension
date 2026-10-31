import { describe, expect, test } from 'bun:test';
import { getRefreshResult, getSaveConnectionResult } from '../lib/connection-errors';

describe('getSaveConnectionResult', () => {
  test('returns success copy when refresh succeeds', () => {
    expect(getSaveConnectionResult(null)).toEqual({
      status: 'success',
      message: 'Settings saved. Connected to qui.',
    });
  });

  test('names the instances whose categories failed to load', () => {
    expect(getSaveConnectionResult(null, ['alpha', 'beta'])).toEqual({
      status: 'error',
      message: 'Settings saved. Connected to qui, but categories failed to load for: alpha, beta.',
    });
  });

  test('keeps save success separate from connection failure', () => {
    expect(
      getSaveConnectionResult(new Error('Could not reach qui. Check the server URL, DNS, TLS certificate, or proxy settings.')),
    ).toEqual({
      status: 'error',
      message:
        'Settings saved, but connection failed: Could not reach qui. Check the server URL, DNS, TLS certificate, or proxy settings.',
    });
  });
});

describe('getRefreshResult', () => {
  test('reports success when every instance loaded', () => {
    expect(getRefreshResult([])).toEqual({ status: 'success', message: 'Cache refreshed' });
  });

  test('names the instances whose categories failed to load', () => {
    expect(getRefreshResult(['alpha'])).toEqual({
      status: 'error',
      message: 'Cache refreshed, but categories failed to load for: alpha.',
    });
  });
});
