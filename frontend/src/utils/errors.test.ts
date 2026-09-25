import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './errors';

function apiError(data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = {
    data,
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config,
  } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response);
}

describe('getErrorMessage', () => {
  it('uses a string detail from the backend', () => {
    expect(getErrorMessage(apiError({ detail: '不能刪除所有頁面' }), 'fallback'))
      .toBe('不能刪除所有頁面');
  });

  it('joins validation messages', () => {
    const error = apiError({ detail: [{ msg: '第一個錯誤' }, {}, { msg: '第二個錯誤' }] });

    expect(getErrorMessage(error, 'fallback')).toBe('第一個錯誤；第二個錯誤');
  });

  it('falls back for responses without a usable detail', () => {
    expect(getErrorMessage(apiError({ detail: [] }), 'fallback')).toBe('fallback');
    expect(getErrorMessage(apiError('<html>502</html>'), 'fallback')).toBe('fallback');
  });

  it('falls back for non-API errors', () => {
    expect(getErrorMessage(new Error('network down'), 'fallback')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
