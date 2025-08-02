// FlexiRecord utilities tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseFlexiStructure,
  transformFlexiRecordData,
  getConsolidatedFlexiRecord,
  extractVikingEventFields,
} from '../flexiRecordUtils.js';

// Mock the API functions
vi.mock('../../services/api.js', () => ({
  getFlexiRecords: vi.fn(),
  getFlexiStructure: vi.fn(),
  getSingleFlexiRecord: vi.fn(),
}));

// Mock logger and sentry
vi.mock('../../services/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LOG_CATEGORIES: {
    APP: 'APP',
    API: 'API',
    ERROR: 'ERROR',
  },
}));

vi.mock('../../services/sentry.js', () => ({
  sentryUtils: {
    captureException: vi.fn(),
  },
}));

describe('FlexiRecord Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseFlexiStructure', () => {
    it('should parse structure data with config JSON', () => {
      const structureData = {
        name: 'Viking Event Mgmt',
        extraid: '72758',
        config: '[{"id":"f_1","name":"CampGroup","width":"150"},{"id":"f_2","name":"SignedInBy","width":"150"}]',
        structure: [
          {
            rows: [
              {
                name: 'CampGroup',
                field: 'f_1',
                width: '150px',
                editable: true,
              },
            ],
          },
        ],
      };

      const fieldMapping = parseFlexiStructure(structureData);

      expect(fieldMapping).toBeInstanceOf(Map);
      expect(fieldMapping.size).toBe(2);
      
      const f1Field = fieldMapping.get('f_1');
      expect(f1Field).toEqual({
        name: 'CampGroup',
        width: '150px',
        fieldId: 'f_1',
        editable: true,
        formatter: undefined,
      });

      const f2Field = fieldMapping.get('f_2');
      expect(f2Field).toEqual({
        name: 'SignedInBy',
        width: '150',
        fieldId: 'f_2',
      });
    });

    it('should handle structure data without config', () => {
      const structureData = {
        name: 'Test Record',
        structure: [
          {
            rows: [
              {
                name: 'CampGroup',
                field: 'f_1',
                width: '150px',
              },
            ],
          },
        ],
      };

      const fieldMapping = parseFlexiStructure(structureData);

      expect(fieldMapping.size).toBe(1);
      expect(fieldMapping.get('f_1')).toEqual({
        name: 'CampGroup',
        width: '150px',
        fieldId: 'f_1',
        editable: false,
        formatter: undefined,
      });
    });

    it('should handle invalid config JSON gracefully', () => {
      const structureData = {
        name: 'Test Record',
        config: 'invalid json',
        structure: [
          {
            rows: [
              {
                name: 'CampGroup',
                field: 'f_1',
              },
            ],
          },
        ],
      };

      const fieldMapping = parseFlexiStructure(structureData);

      expect(fieldMapping.size).toBe(1);
      expect(fieldMapping.get('f_1').name).toBe('CampGroup');
    });

    it('should throw error for invalid structure data', () => {
      expect(() => parseFlexiStructure(null)).toThrow('Invalid structure data: must be an object');
      expect(() => parseFlexiStructure('string')).toThrow('Invalid structure data: must be an object');
    });
  });

  describe('transformFlexiRecordData', () => {
    it('should transform flexirecord data with field mapping', () => {
      const flexiData = {
        identifier: 'scoutid',
        items: [
          {
            scoutid: '1809627',
            firstname: 'Thea',
            lastname: 'Marriner',
            f_1: 1,
            f_2: 'Leader Name',
            f_3: '2024-01-15 10:30',
          },
          {
            scoutid: '1601995',
            firstname: 'Elliot',
            lastname: 'Smith',
            f_1: 2,
            f_2: 'Another Leader',
            f_3: '2024-01-15 10:45',
          },
        ],
      };

      const fieldMapping = new Map([
        ['f_1', { name: 'CampGroup', fieldId: 'f_1' }],
        ['f_2', { name: 'SignedInBy', fieldId: 'f_2' }],
        ['f_3', { name: 'SignedInWhen', fieldId: 'f_3' }],
      ]);

      const result = transformFlexiRecordData(flexiData, fieldMapping);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('fieldMapping');
      expect(result).toHaveProperty('_metadata');
      
      expect(result.items).toHaveLength(2);
      
      const firstScout = result.items[0];
      expect(firstScout).toHaveProperty('CampGroup', 1);
      expect(firstScout).toHaveProperty('SignedInBy', 'Leader Name');
      expect(firstScout).toHaveProperty('SignedInWhen', '2024-01-15 10:30');
      expect(firstScout).toHaveProperty('_original_f_1', 1);
      expect(firstScout).toHaveProperty('_original_f_2', 'Leader Name');
      
      // Original fields should still exist
      expect(firstScout).toHaveProperty('firstname', 'Thea');
      expect(firstScout).toHaveProperty('scoutid', '1809627');
    });

    it('should handle empty items array', () => {
      const flexiData = {
        identifier: 'scoutid',
        items: [],
      };

      const fieldMapping = new Map([
        ['f_1', { name: 'CampGroup' }],
      ]);

      const result = transformFlexiRecordData(flexiData, fieldMapping);

      expect(result.items).toHaveLength(0);
      expect(result).toHaveProperty('fieldMapping');
    });

    it('should handle missing items array', () => {
      const flexiData = {
        identifier: 'scoutid',
      };

      const fieldMapping = new Map();

      const result = transformFlexiRecordData(flexiData, fieldMapping);

      expect(result.items).toHaveLength(0);
    });

    it('should throw error for invalid inputs', () => {
      expect(() => transformFlexiRecordData(null, new Map())).toThrow('Invalid flexiData: must be an object');
      expect(() => transformFlexiRecordData({}, null)).toThrow('Invalid fieldMapping: must be a Map');
      expect(() => transformFlexiRecordData({}, 'not a map')).toThrow('Invalid fieldMapping: must be a Map');
    });
  });

  describe('getConsolidatedFlexiRecord', () => {
    it('should consolidate flexirecord data successfully', async () => {
      const { getFlexiStructure, getSingleFlexiRecord } = await import('../../services/api.js');
      
      const mockStructure = {
        name: 'Viking Event Mgmt',
        extraid: '72758',
        sectionid: '49097',
        config: '[{"id":"f_1","name":"CampGroup","width":"150"}]',
        structure: [],
        archived: '0',
        soft_deleted: '0',
      };

      const mockData = {
        identifier: 'scoutid',
        items: [
          {
            scoutid: '1809627',
            firstname: 'Thea',
            f_1: 1,
          },
        ],
      };

      getFlexiStructure.mockResolvedValue(mockStructure);
      getSingleFlexiRecord.mockResolvedValue(mockData);

      const result = await getConsolidatedFlexiRecord('49097', '72758', 'term123', 'token');

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('_structure');
      expect(result._structure.name).toBe('Viking Event Mgmt');
      expect(result._structure.archived).toBe(false);
      
      expect(result.items[0]).toHaveProperty('CampGroup', 1);
      expect(result.items[0]).toHaveProperty('firstname', 'Thea');

      expect(getFlexiStructure).toHaveBeenCalledWith('72758', '49097', 'term123', 'token');
      expect(getSingleFlexiRecord).toHaveBeenCalledWith('72758', '49097', 'term123', 'token');
    });

    it('should throw error for missing parameters', async () => {
      await expect(getConsolidatedFlexiRecord()).rejects.toThrow('Missing required parameters');
      await expect(getConsolidatedFlexiRecord('section')).rejects.toThrow('Missing required parameters');
    });

    it('should handle API failures', async () => {
      const { getFlexiStructure } = await import('../../services/api.js');
      
      getFlexiStructure.mockRejectedValue(new Error('API Error'));

      await expect(
        getConsolidatedFlexiRecord('49097', '72758', 'term123', 'token'),
      ).rejects.toThrow('API Error');
    });
  });


  describe('extractVikingEventFields', () => {
    it('should extract Viking-specific fields', () => {
      const consolidatedData = {
        items: [
          {
            scoutid: '1809627',
            firstname: 'Thea',
            lastname: 'Marriner',
            dob: '2017-06-07',
            age: '08 / 00',
            patrol: 'Black Lodge',
            patrolid: '119075',
            photo_guid: 'some-guid',
            CampGroup: 1,
            SignedInBy: 'Leader Name',
            SignedInWhen: '2024-01-15 10:30',
            SignedOutBy: '',
            SignedOutWhen: '',
            someOtherField: 'ignored',
          },
        ],
      };

      const result = extractVikingEventFields(consolidatedData);

      expect(result).toHaveLength(1);
      
      const scout = result[0];
      expect(scout).toHaveProperty('scoutid', '1809627');
      expect(scout).toHaveProperty('firstname', 'Thea');
      expect(scout).toHaveProperty('CampGroup', 1);
      expect(scout).toHaveProperty('SignedInBy', 'Leader Name');
      expect(scout).toHaveProperty('SignedInWhen', '2024-01-15 10:30');
      expect(scout).toHaveProperty('SignedOutBy', '');
      expect(scout).toHaveProperty('SignedOutWhen', '');
      
      // Should not have non-Viking fields
      expect(scout).not.toHaveProperty('someOtherField');
    });

    it('should handle missing Viking fields gracefully', () => {
      const consolidatedData = {
        items: [
          {
            scoutid: '123',
            firstname: 'Test',
            CampGroup: 1,
            // Missing other Viking fields
          },
        ],
      };

      const result = extractVikingEventFields(consolidatedData);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('CampGroup', 1);
      expect(result[0]).not.toHaveProperty('SignedInBy');
    });

    it('should return empty array for invalid input', () => {
      expect(extractVikingEventFields(null)).toEqual([]);
      expect(extractVikingEventFields({})).toEqual([]);
      expect(extractVikingEventFields({ items: null })).toEqual([]);
    });
  });
});