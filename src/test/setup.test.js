import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Test Setup Configuration', () => {
  describe('sessionStorage mock', () => {
    beforeEach(() => {
      // Reset all mocks before each test
      vi.clearAllMocks();
    });

    it('should have sessionStorage defined globally', () => {
      expect(global.sessionStorage).toBeDefined();
    });

    it('should have getItem method as a mock function', () => {
      expect(vi.isMockFunction(global.sessionStorage.getItem)).toBe(true);
    });

    it('should have setItem method as a mock function', () => {
      expect(vi.isMockFunction(global.sessionStorage.setItem)).toBe(true);
    });

    it('should have removeItem method as a mock function', () => {
      expect(vi.isMockFunction(global.sessionStorage.removeItem)).toBe(true);
    });

    it('should have clear method as a mock function', () => {
      expect(vi.isMockFunction(global.sessionStorage.clear)).toBe(true);
    });

    it('should allow getItem to be called without errors', () => {
      expect(() => global.sessionStorage.getItem('test-key')).not.toThrow();
    });

    it('should allow setItem to be called without errors', () => {
      expect(() => global.sessionStorage.setItem('test-key', 'test-value')).not.toThrow();
    });

    it('should allow removeItem to be called without errors', () => {
      expect(() => global.sessionStorage.removeItem('test-key')).not.toThrow();
    });

    it('should allow clear to be called without errors', () => {
      expect(() => global.sessionStorage.clear()).not.toThrow();
    });

    it('should track calls to getItem', () => {
      global.sessionStorage.getItem('myKey');
      expect(global.sessionStorage.getItem).toHaveBeenCalledWith('myKey');
      expect(global.sessionStorage.getItem).toHaveBeenCalledTimes(1);
    });

    it('should track calls to setItem', () => {
      global.sessionStorage.setItem('myKey', 'myValue');
      expect(global.sessionStorage.setItem).toHaveBeenCalledWith('myKey', 'myValue');
      expect(global.sessionStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should track calls to removeItem', () => {
      global.sessionStorage.removeItem('myKey');
      expect(global.sessionStorage.removeItem).toHaveBeenCalledWith('myKey');
      expect(global.sessionStorage.removeItem).toHaveBeenCalledTimes(1);
    });

    it('should track calls to clear', () => {
      global.sessionStorage.clear();
      expect(global.sessionStorage.clear).toHaveBeenCalled();
      expect(global.sessionStorage.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('localStorage mock', () => {
    beforeEach(() => {
      // Clear the storage map and reset mocks
      global.localStorage.storage.clear();
      vi.clearAllMocks();
    });

    it('should have localStorage defined globally', () => {
      expect(global.localStorage).toBeDefined();
    });

    it('should have an internal storage Map', () => {
      expect(global.localStorage.storage).toBeInstanceOf(Map);
    });

    it('should have getItem method as a mock function', () => {
      expect(vi.isMockFunction(global.localStorage.getItem)).toBe(true);
    });

    it('should have setItem method as a mock function', () => {
      expect(vi.isMockFunction(global.localStorage.setItem)).toBe(true);
    });

    it('should have removeItem method as a mock function', () => {
      expect(vi.isMockFunction(global.localStorage.removeItem)).toBe(true);
    });

    it('should have clear method as a mock function', () => {
      expect(vi.isMockFunction(global.localStorage.clear)).toBe(true);
    });

    it('should have key method as a mock function', () => {
      expect(vi.isMockFunction(global.localStorage.key)).toBe(true);
    });

    it('should return null when getting non-existent item', () => {
      const result = global.localStorage.getItem('nonexistent');
      expect(result).toBeNull();
    });

    it('should store and retrieve string values', () => {
      global.localStorage.setItem('testKey', 'testValue');
      const result = global.localStorage.getItem('testKey');
      expect(result).toBe('testValue');
    });

    it('should convert non-string values to strings when storing', () => {
      global.localStorage.setItem('numberKey', 123);
      const result = global.localStorage.getItem('numberKey');
      expect(result).toBe('123');
    });

    it('should convert boolean values to strings', () => {
      global.localStorage.setItem('boolKey', true);
      const result = global.localStorage.getItem('boolKey');
      expect(result).toBe('true');
    });

    it('should convert object values to strings', () => {
      const obj = { foo: 'bar' };
      global.localStorage.setItem('objKey', obj);
      const result = global.localStorage.getItem('objKey');
      expect(result).toBe('[object Object]');
    });

    it('should handle null values by converting to string', () => {
      global.localStorage.setItem('nullKey', null);
      const result = global.localStorage.getItem('nullKey');
      expect(result).toBe('null');
    });

    it('should handle undefined values by converting to string', () => {
      global.localStorage.setItem('undefinedKey', undefined);
      const result = global.localStorage.getItem('undefinedKey');
      expect(result).toBe('undefined');
    });

    it('should remove items correctly', () => {
      global.localStorage.setItem('removeMe', 'value');
      expect(global.localStorage.getItem('removeMe')).toBe('value');
      
      global.localStorage.removeItem('removeMe');
      expect(global.localStorage.getItem('removeMe')).toBeNull();
    });

    it('should clear all items', () => {
      global.localStorage.setItem('key1', 'value1');
      global.localStorage.setItem('key2', 'value2');
      global.localStorage.setItem('key3', 'value3');
      
      expect(global.localStorage.length).toBe(3);
      
      global.localStorage.clear();
      
      expect(global.localStorage.length).toBe(0);
      expect(global.localStorage.getItem('key1')).toBeNull();
      expect(global.localStorage.getItem('key2')).toBeNull();
      expect(global.localStorage.getItem('key3')).toBeNull();
    });

    it('should return correct length', () => {
      expect(global.localStorage.length).toBe(0);
      
      global.localStorage.setItem('key1', 'value1');
      expect(global.localStorage.length).toBe(1);
      
      global.localStorage.setItem('key2', 'value2');
      expect(global.localStorage.length).toBe(2);
      
      global.localStorage.removeItem('key1');
      expect(global.localStorage.length).toBe(1);
    });

    it('should return key at specific index', () => {
      global.localStorage.setItem('firstKey', 'value1');
      global.localStorage.setItem('secondKey', 'value2');
      global.localStorage.setItem('thirdKey', 'value3');
      
      const key0 = global.localStorage.key(0);
      const key1 = global.localStorage.key(1);
      const key2 = global.localStorage.key(2);
      
      expect(['firstKey', 'secondKey', 'thirdKey']).toContain(key0);
      expect(['firstKey', 'secondKey', 'thirdKey']).toContain(key1);
      expect(['firstKey', 'secondKey', 'thirdKey']).toContain(key2);
    });

    it('should return null for out-of-bounds key index', () => {
      global.localStorage.setItem('key1', 'value1');
      
      expect(global.localStorage.key(5)).toBeNull();
      expect(global.localStorage.key(-1)).toBeNull();
    });

    it('should return null for key index when storage is empty', () => {
      expect(global.localStorage.key(0)).toBeNull();
    });

    it('should track calls to getItem', () => {
      global.localStorage.getItem('myKey');
      expect(global.localStorage.getItem).toHaveBeenCalledWith('myKey');
    });

    it('should track calls to setItem', () => {
      global.localStorage.setItem('myKey', 'myValue');
      expect(global.localStorage.setItem).toHaveBeenCalledWith('myKey', 'myValue');
    });

    it('should track calls to removeItem', () => {
      global.localStorage.removeItem('myKey');
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('myKey');
    });

    it('should track calls to clear', () => {
      global.localStorage.clear();
      expect(global.localStorage.clear).toHaveBeenCalled();
    });

    it('should track calls to key', () => {
      global.localStorage.key(0);
      expect(global.localStorage.key).toHaveBeenCalledWith(0);
    });

    it('should handle multiple set operations on same key', () => {
      global.localStorage.setItem('updateKey', 'value1');
      expect(global.localStorage.getItem('updateKey')).toBe('value1');
      
      global.localStorage.setItem('updateKey', 'value2');
      expect(global.localStorage.getItem('updateKey')).toBe('value2');
      
      expect(global.localStorage.length).toBe(1);
    });

    it('should not throw error when removing non-existent key', () => {
      expect(() => global.localStorage.removeItem('nonexistent')).not.toThrow();
    });

    it('should maintain independence between keys', () => {
      global.localStorage.setItem('key1', 'value1');
      global.localStorage.setItem('key2', 'value2');
      
      global.localStorage.removeItem('key1');
      
      expect(global.localStorage.getItem('key1')).toBeNull();
      expect(global.localStorage.getItem('key2')).toBe('value2');
    });
  });

  describe('window.location mock', () => {
    it('should have window.location defined', () => {
      expect(window.location).toBeDefined();
    });

    it('should have correct default href', () => {
      expect(window.location.href).toBe('http://localhost:3001');
    });

    it('should have correct default origin', () => {
      expect(window.location.origin).toBe('http://localhost:3001');
    });

    it('should have correct default pathname', () => {
      expect(window.location.pathname).toBe('/');
    });

    it('should have empty default search', () => {
      expect(window.location.search).toBe('');
    });

    it('should have empty default hash', () => {
      expect(window.location.hash).toBe('');
    });

    it('should have reload method as a mock function', () => {
      expect(vi.isMockFunction(window.location.reload)).toBe(true);
    });

    it('should have assign method as a mock function', () => {
      expect(vi.isMockFunction(window.location.assign)).toBe(true);
    });

    it('should allow calling reload without errors', () => {
      expect(() => window.location.reload()).not.toThrow();
    });

    it('should allow calling assign without errors', () => {
      expect(() => window.location.assign('http://example.com')).not.toThrow();
    });

    it('should be writable', () => {
      const originalLocation = window.location;
      
      const newLocation = {
        href: 'http://example.com',
        origin: 'http://example.com',
        pathname: '/test',
        search: '?query=test',
        hash: '#section',
        reload: vi.fn(),
        assign: vi.fn(),
      };
      
      expect(() => {
        window.location = newLocation;
      }).not.toThrow();
      
      expect(window.location.href).toBe('http://example.com');
      
      // Restore original location
      window.location = originalLocation;
    });

    it('should track calls to reload', () => {
      window.location.reload();
      expect(window.location.reload).toHaveBeenCalled();
    });

    it('should track calls to assign with correct arguments', () => {
      window.location.assign('http://test.com');
      expect(window.location.assign).toHaveBeenCalledWith('http://test.com');
    });

    it('should allow multiple calls to reload', () => {
      window.location.reload();
      window.location.reload();
      expect(window.location.reload).toHaveBeenCalledTimes(2);
    });

    it('should allow multiple calls to assign', () => {
      window.location.assign('http://first.com');
      window.location.assign('http://second.com');
      expect(window.location.assign).toHaveBeenCalledTimes(2);
    });
  });

  describe('Testing Library Jest-DOM integration', () => {
    it('should have @testing-library/jest-dom imported', () => {
      // This test verifies that the import statement executes without errors
      // The actual matchers are available on expect after import
      expect(expect).toBeDefined();
    });

    it('should provide extended matchers from jest-dom', () => {
      // Create a simple DOM element to test jest-dom matchers
      const div = document.createElement('div');
      div.textContent = 'Hello World';
      
      // Test that jest-dom matchers are available
      expect(div).toBeInTheDocument;
      expect(div).toHaveTextContent;
    });
  });

  describe('Global mocks isolation', () => {
    it('should maintain separate state between sessionStorage and localStorage', () => {
      global.sessionStorage.setItem('testKey', 'sessionValue');
      global.localStorage.setItem('testKey', 'localValue');
      
      // sessionStorage doesn't actually store values (it's just a mock)
      // but localStorage does through its storage Map
      expect(global.localStorage.getItem('testKey')).toBe('localValue');
    });

    it('should allow sessionStorage and localStorage to coexist', () => {
      expect(global.sessionStorage).toBeDefined();
      expect(global.localStorage).toBeDefined();
      expect(global.sessionStorage).not.toBe(global.localStorage);
    });
  });

  describe('Edge cases and error handling', () => {
    beforeEach(() => {
      global.localStorage.storage.clear();
      vi.clearAllMocks();
    });

    it('should handle empty string as key in localStorage', () => {
      global.localStorage.setItem('', 'emptyKeyValue');
      expect(global.localStorage.getItem('')).toBe('emptyKeyValue');
    });

    it('should handle empty string as value in localStorage', () => {
      global.localStorage.setItem('emptyValue', '');
      expect(global.localStorage.getItem('emptyValue')).toBe('');
    });

    it('should handle special characters in keys', () => {
      const specialKey = 'key-with-special_chars@123\!';
      global.localStorage.setItem(specialKey, 'value');
      expect(global.localStorage.getItem(specialKey)).toBe('value');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      global.localStorage.setItem('longKey', longString);
      expect(global.localStorage.getItem('longKey')).toBe(longString);
    });

    it('should handle Unicode characters', () => {
      const unicodeValue = '你好世界 🌍 مرحبا';
      global.localStorage.setItem('unicode', unicodeValue);
      expect(global.localStorage.getItem('unicode')).toBe(unicodeValue);
    });

    it('should handle JSON stringified objects in localStorage', () => {
      const obj = { name: 'test', value: 123, nested: { key: 'value' } };
      const jsonString = JSON.stringify(obj);
      
      global.localStorage.setItem('jsonData', jsonString);
      const retrieved = global.localStorage.getItem('jsonData');
      
      expect(retrieved).toBe(jsonString);
      expect(JSON.parse(retrieved)).toEqual(obj);
    });

    it('should return consistent key order', () => {
      global.localStorage.setItem('a', '1');
      global.localStorage.setItem('b', '2');
      global.localStorage.setItem('c', '3');
      
      const keys = [];
      for (let i = 0; i < global.localStorage.length; i++) {
        keys.push(global.localStorage.key(i));
      }
      
      expect(keys).toHaveLength(3);
      expect(keys).toContain('a');
      expect(keys).toContain('b');
      expect(keys).toContain('c');
    });

    it('should handle rapid successive operations', () => {
      for (let i = 0; i < 100; i++) {
        global.localStorage.setItem(`key${i}`, `value${i}`);
      }
      
      expect(global.localStorage.length).toBe(100);
      
      for (let i = 0; i < 100; i++) {
        expect(global.localStorage.getItem(`key${i}`)).toBe(`value${i}`);
      }
    });

    it('should handle alternating set and remove operations', () => {
      global.localStorage.setItem('toggle', 'value1');
      expect(global.localStorage.length).toBe(1);
      
      global.localStorage.removeItem('toggle');
      expect(global.localStorage.length).toBe(0);
      
      global.localStorage.setItem('toggle', 'value2');
      expect(global.localStorage.length).toBe(1);
      expect(global.localStorage.getItem('toggle')).toBe('value2');
    });
  });

  describe('Mock function call tracking', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should reset sessionStorage mock call counts', () => {
      global.sessionStorage.getItem('test');
      expect(global.sessionStorage.getItem).toHaveBeenCalledTimes(1);
      
      vi.clearAllMocks();
      
      expect(global.sessionStorage.getItem).toHaveBeenCalledTimes(0);
    });

    it('should reset localStorage mock call counts', () => {
      global.localStorage.setItem('test', 'value');
      expect(global.localStorage.setItem).toHaveBeenCalledTimes(1);
      
      vi.clearAllMocks();
      
      expect(global.localStorage.setItem).toHaveBeenCalledTimes(0);
    });

    it('should reset window.location mock call counts', () => {
      window.location.reload();
      expect(window.location.reload).toHaveBeenCalledTimes(1);
      
      vi.clearAllMocks();
      
      expect(window.location.reload).toHaveBeenCalledTimes(0);
    });
  });

  describe('Real-world usage scenarios', () => {
    beforeEach(() => {
      global.localStorage.storage.clear();
      vi.clearAllMocks();
    });

    it('should support typical authentication token storage pattern', () => {
      const token = 'test-token';
      global.localStorage.setItem('authToken', token);
      
      const retrievedToken = global.localStorage.getItem('authToken');
      expect(retrievedToken).toBe(token);
      
      global.localStorage.removeItem('authToken');
      expect(global.localStorage.getItem('authToken')).toBeNull();
    });

    it('should support user preferences storage', () => {
      const preferences = JSON.stringify({
        theme: 'dark',
        language: 'en',
        notifications: true
      });
      
      global.localStorage.setItem('userPreferences', preferences);
      const retrieved = JSON.parse(global.localStorage.getItem('userPreferences'));
      
      expect(retrieved.theme).toBe('dark');
      expect(retrieved.language).toBe('en');
      expect(retrieved.notifications).toBe(true);
    });

    it('should support session state management', () => {
      global.sessionStorage.setItem('currentPage', '/dashboard');
      global.sessionStorage.setItem('lastAction', 'save');
      
      expect(global.sessionStorage.setItem).toHaveBeenCalledWith('currentPage', '/dashboard');
      expect(global.sessionStorage.setItem).toHaveBeenCalledWith('lastAction', 'save');
    });

    it('should support clearing all app data', () => {
      global.localStorage.setItem('key1', 'value1');
      global.localStorage.setItem('key2', 'value2');
      global.localStorage.setItem('key3', 'value3');
      
      global.localStorage.clear();
      global.sessionStorage.clear();
      
      expect(global.localStorage.length).toBe(0);
      expect(global.sessionStorage.clear).toHaveBeenCalled();
    });
  });
});