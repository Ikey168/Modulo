import { afterEach, describe, expect, it, vi } from 'vitest';
import { installAndroidDownloads, type DownloadOutcome } from '../androidDownloads';

let stop: (() => void) | undefined;
afterEach(() => { stop?.(); stop = undefined; });

describe('Android downloads', () => {
  it('routes a blob download to the system save dialog even after the caller revoked the URL', async () => {
    let objectCounter = 0;
    URL.createObjectURL ??= () => `blob:test/${objectCounter++}`;
    URL.revokeObjectURL ??= () => {};
    const saveDocument = vi.fn(async () => ({ saved: true }));
    const outcomes: DownloadOutcome[] = [];
    stop = installAndroidDownloads({ saveDocument }, outcome => outcomes.push(outcome));

    const url = URL.createObjectURL(new Blob(['{"a":1}'], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'backup.json';
    link.click();
    URL.revokeObjectURL(url);

    await vi.waitFor(() => expect(outcomes).toEqual([{ name: 'backup.json', saved: true, cancelled: false }]));
    expect(saveDocument).toHaveBeenCalledWith({ name: 'backup.json', mime: 'application/json', data: btoa('{"a":1}') });
  });

  it('handles data URLs, reports cancellation and leaves ordinary links alone', async () => {
    const saveDocument = vi.fn(async () => ({ cancelled: true }));
    const outcomes: DownloadOutcome[] = [];
    stop = installAndroidDownloads({ saveDocument }, outcome => outcomes.push(outcome));
    const link = document.createElement('a');
    link.href = `data:text/csv;base64,${btoa('a,b')}`; link.download = 'rows.csv';
    link.click();
    await vi.waitFor(() => expect(outcomes).toEqual([{ name: 'rows.csv', saved: false, cancelled: true }]));
    expect(saveDocument).toHaveBeenCalledWith({ name: 'rows.csv', mime: 'text/csv', data: btoa('a,b') });

    const plain = document.createElement('a');
    plain.href = '#section';
    plain.click();
    expect(saveDocument).toHaveBeenCalledTimes(1);
  });
});
