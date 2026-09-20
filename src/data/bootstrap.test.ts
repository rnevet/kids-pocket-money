import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileIdStore, resolveFamilyFile, roleOf } from './bootstrap';
import { AppError } from '../google/errors';
import type { Drive, DriveFile } from '../google/drive';

const file = (id: string, canEdit = true): DriveFile => ({
  id,
  name: id,
  capabilities: { canEdit, canShare: canEdit },
});

function drive(over: Partial<Drive>): Drive {
  return { getFile: vi.fn(), listAppFiles: vi.fn(async () => []), ...over } as unknown as Drive;
}

describe('resolveFamilyFile', () => {
  beforeEach(() => fileIdStore.set(null));

  it('uses the cached id when accessible', async () => {
    fileIdStore.set('c');
    const d = drive({ getFile: vi.fn(async () => file('c')) });
    expect(await resolveFamilyFile(d)).toEqual({ kind: 'found', file: file('c') });
    expect(d.listAppFiles).not.toHaveBeenCalled();
  });

  it('drops a cached id that is gone and falls back to search', async () => {
    fileIdStore.set('gone');
    const d = drive({
      getFile: vi.fn(async () => {
        throw new AppError('not_found', 'x', 404);
      }),
      listAppFiles: vi.fn(async () => [file('a')]),
    });
    expect(await resolveFamilyFile(d)).toEqual({ kind: 'found', file: file('a') });
    expect(fileIdStore.get()).toBeNull();
  });

  it('propagates network errors instead of guessing', async () => {
    fileIdStore.set('c');
    const d = drive({
      getFile: vi.fn(async () => {
        throw new AppError('network', 'offline');
      }),
    });
    await expect(resolveFamilyFile(d)).rejects.toMatchObject({ kind: 'network' });
  });

  it('none / choose', async () => {
    expect(await resolveFamilyFile(drive({}))).toEqual({ kind: 'none' });
    const many = [file('a'), file('b')];
    expect(await resolveFamilyFile(drive({ listAppFiles: vi.fn(async () => many) }))).toEqual({
      kind: 'choose',
      files: many,
    });
  });

  it('roleOf', () => {
    expect(roleOf(file('a', true))).toBe('parent');
    expect(roleOf(file('a', false))).toBe('viewer');
    expect(roleOf({ id: 'x', name: 'x' })).toBe('viewer');
  });
});
