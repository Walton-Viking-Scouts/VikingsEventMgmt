import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyToClipboard, shareOrigin } from '../clipboard.js';

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.execCommand;
    vi.restoreAllMocks();
  });

  it('uses the async Clipboard API when available and returns true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const ok = await copyToClipboard('https://example.com/x');

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.com/x');
  });

  it('falls back to the textarea/execCommand path when the Clipboard API rejects', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    document.execCommand = vi.fn().mockReturnValue(true);
    const append = vi.spyOn(document.body, 'appendChild');
    const remove = vi.spyOn(document.body, 'removeChild');

    const ok = await copyToClipboard('fallback-text');

    expect(ok).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(append).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled(); // temp textarea cleaned up
  });

  it('falls back to execCommand when the Clipboard API is absent', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn().mockReturnValue(true);

    expect(await copyToClipboard('x')).toBe(true);
  });

  it('returns false when both the API and the fallback fail', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn(() => {
      throw new Error('execCommand blocked');
    });

    expect(await copyToClipboard('x')).toBe(false);
  });
});

describe('shareOrigin', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'location');
  afterEach(() => {
    if (original) Object.defineProperty(window, 'location', original);
  });

  function setOrigin(origin) {
    Object.defineProperty(window, 'location', { value: { origin }, writable: true, configurable: true });
  }

  it('passes through a real https web origin', () => {
    setOrigin('https://vikingeventmgmt.onrender.com');
    expect(shareOrigin()).toBe('https://vikingeventmgmt.onrender.com');
  });

  it('falls back to the production origin for a localhost dev/native origin', () => {
    setOrigin('https://localhost:3001');
    expect(shareOrigin()).toBe('https://vikingeventmgmt.onrender.com');
  });

  it('falls back to the production origin for a capacitor native origin', () => {
    setOrigin('capacitor://localhost');
    expect(shareOrigin()).toBe('https://vikingeventmgmt.onrender.com');
  });
});
