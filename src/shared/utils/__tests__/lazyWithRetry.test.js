import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadModuleWithReload } from '../lazyWithRetry.js';

describe('loadModuleWithReload', () => {
  const reloadMock = vi.fn();
  let originalLocation;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.getItem.mockReturnValue(null);
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('returns the module when import succeeds', async () => {
    const module = { default: () => null };
    const result = await loadModuleWithReload(() => Promise.resolve(module));
    expect(result).toBe(module);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('reloads the page once when import fails', async () => {
    const importFn = vi.fn(() => Promise.reject(new TypeError('Importing a module script failed.')));
    const pending = loadModuleWithReload(importFn);
    await vi.waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    expect(sessionStorage.setItem).toHaveBeenCalledWith('lazy_chunk_reload_attempted', 'true');
    void pending;
  });

  it('rethrows when import fails after a reload was already attempted', async () => {
    sessionStorage.getItem.mockReturnValue('true');
    const error = new TypeError('Importing a module script failed.');
    await expect(loadModuleWithReload(() => Promise.reject(error))).rejects.toThrow(error);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('clears the reload flag after a successful import', async () => {
    await loadModuleWithReload(() => Promise.resolve({ default: () => null }));
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('lazy_chunk_reload_attempted');
  });
});
