import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock localStorage with complete interface
const localStorageMock = {
  storage: new Map(),
  getItem: vi.fn((key) => (
    localStorageMock.storage.has(key)
      ? localStorageMock.storage.get(key)
      : null
  )),
  setItem: vi.fn((key, value) => localStorageMock.storage.set(key, String(value))),
  removeItem: vi.fn((key) => localStorageMock.storage.delete(key)),
  clear: vi.fn(() => localStorageMock.storage.clear()),
  get length() { return localStorageMock.storage.size; },
  key: vi.fn((index) => Array.from(localStorageMock.storage.keys())[index] || null),
};
global.localStorage = localStorageMock;

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3001',
    origin: 'http://localhost:3001',
    pathname: '/',
    search: '',
    hash: '',
    reload: vi.fn(),
    assign: vi.fn(),
  },
  writable: true,
});
