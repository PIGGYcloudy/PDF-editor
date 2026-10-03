import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import api, { deletePDF } from './api';

afterEach(() => vi.restoreAllMocks());

describe('remove expired files', () => {
  it('treats a missing server file as already deleted', async () => {
    vi.spyOn(api, 'delete').mockRejectedValue(new AxiosError('expired', undefined,
      undefined, undefined, { status: 404 } as AxiosResponse));
    await expect(deletePDF('expired')).resolves.toBeUndefined();
  });
  it('keeps real failures visible so the workspace does not silently lose a file', async () => {
    const failure = new AxiosError('server error', undefined,
      undefined, undefined, { status: 500 } as AxiosResponse);
    vi.spyOn(api, 'delete').mockRejectedValue(failure);
    await expect(deletePDF('current')).rejects.toBe(failure);
  });
});
