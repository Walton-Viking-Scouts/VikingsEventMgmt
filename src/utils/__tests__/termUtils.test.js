// Term utilities tests
import {
  findMostRecentTerm,
  getMostRecentTermId,
} from '../termUtils.js';

// Mock logger and sentry
jest.mock('../../services/logger.js', () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LOG_CATEGORIES: {
    APP: 'APP',
    API: 'API',
    ERROR: 'ERROR',
  },
}));

jest.mock('../../services/sentry.js', () => ({
  sentryUtils: {
    captureException: jest.fn(),
  },
}));

describe('Term Utilities', () => {
  let logger, sentryUtils;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Import mocked modules
    logger = (await import('../../services/logger.js')).default;
    sentryUtils = (await import('../../services/sentry.js')).sentryUtils;
  });

  afterEach(async () => {
    // Clean up mocked modules and resources
    jest.clearAllMocks();
    jest.resetModules();
    
    // Clear module references to prevent memory leaks
    logger = null;
    sentryUtils = null;
  });

  describe('findMostRecentTerm', () => {
    it('should find the most recent term by end date', () => {
      const terms = [
        { termid: '1', enddate: '2023-07-31', name: 'Summer 2023' },
        { termid: '2', enddate: '2023-12-15', name: 'Autumn 2023' },
        { termid: '3', enddate: '2024-03-31', name: 'Spring 2024' },
      ];

      const result = findMostRecentTerm(terms);

      expect(result).toEqual({
        termid: '3',
        enddate: '2024-03-31',
        name: 'Spring 2024',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Found most recent term',
        {
          termid: '3',
          enddate: '2024-03-31',
          name: 'Spring 2024',
          totalTermsProcessed: 3,
        },
        'APP',
      );
    });

    it('should return null for empty array', () => {
      const result = findMostRecentTerm([]);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'No terms provided to findMostRecentTerm',
        {},
        'APP',
      );
    });

    it('should return single term when only one term provided', () => {
      const terms = [
        { termid: '1', enddate: '2023-07-31', name: 'Summer 2023' },
      ];

      const result = findMostRecentTerm(terms);

      expect(result).toEqual(terms[0]);
      expect(logger.debug).toHaveBeenCalledWith(
        'Found most recent term',
        expect.objectContaining({
          termid: '1',
          enddate: '2023-07-31',
          name: 'Summer 2023',
          totalTermsProcessed: 1,
        }),
        'APP',
      );
    });

    it('should handle terms with same end date', () => {
      const terms = [
        { termid: '1', enddate: '2023-12-31', name: 'Term 1' },
        { termid: '2', enddate: '2023-12-31', name: 'Term 2' },
        { termid: '3', enddate: '2023-12-31', name: 'Term 3' },
      ];

      const result = findMostRecentTerm(terms);

      // Should return the first one found with the latest date
      expect(result.enddate).toBe('2023-12-31');
      expect(['1', '2', '3']).toContain(result.termid);
    });

    it('should handle terms with ISO datetime strings', () => {
      const terms = [
        { termid: '1', enddate: '2023-07-31T23:59:59Z', name: 'Summer 2023' },
        { termid: '2', enddate: '2023-12-15T12:00:00Z', name: 'Autumn 2023' },
        { termid: '3', enddate: '2024-03-31T00:00:00Z', name: 'Spring 2024' },
      ];

      const result = findMostRecentTerm(terms);

      expect(result.termid).toBe('3');
      expect(result.name).toBe('Spring 2024');
    });

    it('should skip terms with invalid end dates', () => {
      const terms = [
        { termid: '1', enddate: 'invalid-date', name: 'Invalid Term' },
        { termid: '2', enddate: '2023-12-15', name: 'Valid Term' },
        { termid: '3', enddate: '', name: 'Empty Date Term' },
      ];

      const result = findMostRecentTerm(terms);

      expect(result.termid).toBe('2');
      expect(result.name).toBe('Valid Term');
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid enddate in term',
        {
          termid: '1',
          enddate: 'invalid-date',
        },
        'APP',
      );
    });

    it('should skip terms without enddate property', () => {
      const terms = [
        { termid: '1', name: 'No End Date Term' },
        { termid: '2', enddate: '2023-12-15', name: 'Valid Term' },
        { termid: '3', enddate: null, name: 'Null End Date Term' },
      ];

      const result = findMostRecentTerm(terms);

      expect(result.termid).toBe('2');
      expect(result.name).toBe('Valid Term');
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid term object found',
        expect.objectContaining({
          hasEnddate: false,
        }),
        'APP',
      );
    });

    it('should skip null and undefined terms', () => {
      const terms = [
        null,
        { termid: '2', enddate: '2023-12-15', name: 'Valid Term' },
        undefined,
        { termid: '4', enddate: '2023-06-15', name: 'Another Valid Term' },
      ];

      const result = findMostRecentTerm(terms);

      expect(result.termid).toBe('2');
      expect(result.name).toBe('Valid Term');
      expect(logger.warn).toHaveBeenCalledTimes(2); // Once for null, once for undefined
    });

    it('should skip non-object terms', () => {
      const terms = [
        'string term',
        { termid: '2', enddate: '2023-12-15', name: 'Valid Term' },
        123,
        { termid: '4', enddate: '2023-06-15', name: 'Another Valid Term' },
      ];

      const result = findMostRecentTerm(terms);

      expect(result.termid).toBe('2');
      expect(result.name).toBe('Valid Term');
    });

    it('should return null when all terms are invalid', () => {
      const terms = [
        null,
        undefined,
        'string',
        { termid: '1', name: 'No End Date' },
        { termid: '2', enddate: 'invalid-date' },
      ];

      const result = findMostRecentTerm(terms);

      expect(result).toBeNull();
    });

    it('should handle terms with various date formats', () => {
      const terms = [
        { termid: '1', enddate: '2023-07-31', name: 'ISO Date' },
        { termid: '2', enddate: '2023/12/15', name: 'Slash Date' },
        { termid: '3', enddate: 'Dec 15, 2023', name: 'Text Date' },
        { termid: '4', enddate: '2024-03-31T12:00:00.000Z', name: 'Full ISO' },
      ];

      const result = findMostRecentTerm(terms);

      expect(result.termid).toBe('4');
      expect(result.name).toBe('Full ISO');
    });

    it('should throw error for non-array input', () => {
      expect(() => findMostRecentTerm(null)).toThrow('Invalid terms parameter: expected array, got object');
      expect(() => findMostRecentTerm(undefined)).toThrow('Invalid terms parameter: expected array, got undefined');
      expect(() => findMostRecentTerm('string')).toThrow('Invalid terms parameter: expected array, got string');
      expect(() => findMostRecentTerm({})).toThrow('Invalid terms parameter: expected array, got object');
      expect(() => findMostRecentTerm(123)).toThrow('Invalid terms parameter: expected array, got number');

      expect(logger.error).toHaveBeenCalledWith(
        'Invalid terms parameter for findMostRecentTerm',
        {
          providedType: 'object',
          isArray: false,
          isNull: true,
          isUndefined: false,
        },
        'ERROR',
      );
      expect(sentryUtils.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        {
          tags: {
            operation: 'find_most_recent_term',
            validation_error: true,
          },
          contexts: {
            input: {
              type: 'object',
              isArray: false,
              isNull: true,
            },
          },
        },
      );
    });

    it('should handle processing errors gracefully', () => {
      // Mock Date constructor to throw an error
      const originalDate = global.Date;
      global.Date = function(...args) {
        if (args.length > 0) {
          throw new Error('Date processing error');
        }
        return new originalDate(...args);
      };
      global.Date.prototype = originalDate.prototype;

      const terms = [
        { termid: '1', enddate: '2023-07-31', name: 'Test Term' },
      ];

      try {
        expect(() => findMostRecentTerm(terms)).toThrow('Date processing error');
        expect(logger.error).toHaveBeenCalledWith(
          'Error finding most recent term',
          expect.objectContaining({
            error: 'Date processing error',
            termsCount: 1,
          }),
          'ERROR',
        );
        expect(sentryUtils.captureException).toHaveBeenCalled();
      } finally {
        global.Date = originalDate;
      }
    });
  });

  describe('getMostRecentTermId', () => {
    const sampleAllTerms = {
      '101': [
        { termid: 'term1', enddate: '2023-12-31', name: 'Term 1' },
        { termid: 'term2', enddate: '2024-06-30', name: 'Term 2' },
      ],
      '102': [
        { termid: 'term3', enddate: '2024-03-31', name: 'Term 3' },
      ],
      '103': [],
    };

    it('should return most recent term ID for existing section', () => {
      const result = getMostRecentTermId(101, sampleAllTerms);

      expect(result).toBe('term2');
      expect(logger.debug).toHaveBeenCalledWith(
        'Retrieved most recent term ID for section',
        {
          sectionId: '101',
          termId: 'term2',
          enddate: '2024-06-30',
        },
        'APP',
      );
    });

    it('should handle string section IDs', () => {
      const result = getMostRecentTermId('102', sampleAllTerms);

      expect(result).toBe('term3');
      expect(logger.debug).toHaveBeenCalledWith(
        'Retrieved most recent term ID for section',
        {
          sectionId: '102',
          termId: 'term3',
          enddate: '2024-03-31',
        },
        'APP',
      );
    });

    it('should return null for non-existent section', () => {
      const result = getMostRecentTermId(999, sampleAllTerms);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'No terms found for section',
        {
          sectionId: '999',
          availableSections: ['101', '102', '103'],
        },
        'APP',
      );
    });

    it('should return null for section with empty terms array', () => {
      const result = getMostRecentTermId(103, sampleAllTerms);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'No valid terms found for section',
        {
          sectionId: '103',
          termsCount: 0,
        },
        'APP',
      );
    });

    it('should return null for section with only invalid terms', () => {
      const allTermsWithInvalid = {
        '104': [
          { termid: 'invalid1', name: 'No End Date' },
          { termid: 'invalid2', enddate: 'bad-date' },
          null,
        ],
      };

      const result = getMostRecentTermId(104, allTermsWithInvalid);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'No valid terms found for section',
        {
          sectionId: '104',
          termsCount: 3,
        },
        'APP',
      );
    });

    it('should handle numeric zero as section ID', () => {
      const allTermsWithZero = {
        '0': [
          { termid: 'zero-term', enddate: '2024-01-01', name: 'Zero Section Term' },
        ],
      };

      const result = getMostRecentTermId(0, allTermsWithZero);

      expect(result).toBe('zero-term');
    });

    it('should throw error for null section ID', () => {
      expect(() => getMostRecentTermId(null, sampleAllTerms)).toThrow('Section ID is required');
      expect(logger.error).toHaveBeenCalledWith(
        'Missing section ID for getMostRecentTermId',
        {
          sectionId: null,
          hasAllTerms: true,
        },
        'ERROR',
      );
    });

    it('should throw error for undefined section ID', () => {
      expect(() => getMostRecentTermId(undefined, sampleAllTerms)).toThrow('Section ID is required');
      expect(logger.error).toHaveBeenCalledWith(
        'Missing section ID for getMostRecentTermId',
        {
          sectionId: undefined,
          hasAllTerms: true,
        },
        'ERROR',
      );
    });

    it('should throw error for invalid allTerms parameter', () => {
      expect(() => getMostRecentTermId(101, null)).toThrow('Invalid allTerms parameter: expected object, got object');
      expect(() => getMostRecentTermId(101, undefined)).toThrow('Invalid allTerms parameter: expected object, got undefined');
      expect(() => getMostRecentTermId(101, 'string')).toThrow('Invalid allTerms parameter: expected object, got string');
      // Arrays are objects in JavaScript, so they pass the validation
      expect(() => getMostRecentTermId(101, [])).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Invalid allTerms parameter',
        {
          sectionId: 101,
          allTermsType: 'object',
          isNull: true,
        },
        'ERROR',
      );
    });

    it('should handle findMostRecentTerm throwing an error', () => {
      // Create a scenario where findMostRecentTerm would throw by passing invalid terms
      const problematicTerms = {
        '105': 'not an array', // This will cause findMostRecentTerm to fail
      };

      // This should throw because findMostRecentTerm will receive a string instead of an array
      expect(() => getMostRecentTermId(105, problematicTerms)).toThrow();
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error getting most recent term ID',
        expect.objectContaining({
          sectionId: '105',
          error: expect.any(String),
        }),
        'ERROR',
      );
      expect(sentryUtils.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        {
          tags: {
            operation: 'get_most_recent_term_id',
          },
          contexts: {
            section: {
              sectionId: '105',
              hasTerms: true,
              termsCount: expect.any(Number),
            },
          },
        },
      );
    });

    it('should handle boolean section IDs by converting to string', () => {
      const allTermsWithBoolean = {
        'true': [
          { termid: 'bool-term', enddate: '2024-01-01', name: 'Boolean Section Term' },
        ],
        'false': [
          { termid: 'bool-term-2', enddate: '2024-02-01', name: 'Boolean Section Term 2' },
        ],
      };

      expect(getMostRecentTermId(true, allTermsWithBoolean)).toBe('bool-term');
      expect(getMostRecentTermId(false, allTermsWithBoolean)).toBe('bool-term-2');
    });

    it('should handle complex section objects by string conversion', () => {
      const complexSectionId = { id: 123, name: 'test' };
      const allTermsWithComplex = {
        '[object Object]': [
          { termid: 'complex-term', enddate: '2024-01-01', name: 'Complex Section Term' },
        ],
      };

      const result = getMostRecentTermId(complexSectionId, allTermsWithComplex);
      expect(result).toBe('complex-term');
    });

    it('should provide detailed logging for successful lookups', () => {
      getMostRecentTermId('101', sampleAllTerms);

      expect(logger.debug).toHaveBeenCalledWith(
        'Retrieved most recent term ID for section',
        {
          sectionId: '101',
          termId: 'term2',
          enddate: '2024-06-30',
        },
        'APP',
      );
    });

    it('should provide available sections in warning when section not found', () => {
      getMostRecentTermId('nonexistent', sampleAllTerms);

      expect(logger.warn).toHaveBeenCalledWith(
        'No terms found for section',
        {
          sectionId: 'nonexistent',
          availableSections: ['101', '102', '103'],
        },
        'APP',
      );
    });
  });
});