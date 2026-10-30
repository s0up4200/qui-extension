import { describe, expect, test } from 'bun:test';
import { formatConnectionError, getRefreshResult, getSaveConnectionResult } from '../lib/connection-errors';

describe('formatConnectionError', () => {
  test('maps network errors to actionable setup guidance', () => {
    expect(
      formatConnectionError(new Error('NetworkError when attempting to fetch resource.')),
    ).toBe('Could not reach qui. Check the server URL, DNS, TLS certificate, or proxy settings.');
  });

  test('maps 401 errors to auth guidance', () => {
    expect(
      formatConnectionError(
        new Error('Request failed with status code 401 Unauthorized: GET http://qui/api/instances'),
      ),
    ).toBe('Unauthorized (401). Check the API key and Basic Auth credentials.');
  });

  test('maps 403 errors to access guidance', () => {
    expect(
      formatConnectionError(
        new Error('Request failed with status code 403 Forbidden: GET http://qui/api/instances'),
      ),
    ).toBe('Forbidden (403). Check API access rules and any proxy restrictions.');
  });

  test('maps timeout errors to reachability guidance', () => {
    expect(formatConnectionError(new Error('Request timed out'))).toBe(
      'Request timed out. Check that the qui server is reachable and responding.',
    );
  });
});

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
      getSaveConnectionResult(new Error('NetworkError when attempting to fetch resource.')),
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
