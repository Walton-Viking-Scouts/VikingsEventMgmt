/**
 * Target IndexedDB store definitions for the normalized data storage schema.
 * Documents the keyPaths and indexes that each phase's upgrade() block should create.
 * Used as a reference during implementation -- phases 2-6 use these definitions
 * when replacing existing blob-style stores with properly keyed stores.
 *
 * @type {Record<string, { keyPath: string | string[], indexes: Array<{ name: string, keyPath: string, unique: boolean }> }>}
 */
export const NORMALIZED_STORES = {
  sections: {
    keyPath: 'sectionid',
    indexes: [
      { name: 'sectiontype', keyPath: 'sectiontype', unique: false },
    ],
  },
  events: {
    keyPath: 'eventid',
    indexes: [
      { name: 'sectionid', keyPath: 'sectionid', unique: false },
      { name: 'termid', keyPath: 'termid', unique: false },
      { name: 'startdate', keyPath: 'startdate', unique: false },
    ],
  },
  attendance: {
    keyPath: ['eventid', 'scoutid'],
    indexes: [
      { name: 'eventid', keyPath: 'eventid', unique: false },
      { name: 'scoutid', keyPath: 'scoutid', unique: false },
    ],
  },
  shared_attendance: {
    keyPath: ['eventid', 'sectionid'],
    indexes: [
      { name: 'eventid', keyPath: 'eventid', unique: false },
    ],
  },
  terms: {
    keyPath: 'termid',
    indexes: [
      { name: 'sectionid', keyPath: 'sectionid', unique: false },
      { name: 'startdate', keyPath: 'startdate', unique: false },
    ],
  },
  flexi_lists: {
    keyPath: ['sectionid', 'extraid'],
    indexes: [
      { name: 'sectionid', keyPath: 'sectionid', unique: false },
    ],
  },
  flexi_structure: {
    keyPath: 'extraid',
    indexes: [],
  },
  flexi_data: {
    keyPath: ['extraid', 'sectionid', 'termid'],
    indexes: [
      { name: 'extraid', keyPath: 'extraid', unique: false },
      { name: 'sectionid', keyPath: 'sectionid', unique: false },
    ],
  },
};

/**
 * IndexedDB stores that remain unchanged during the normalization process.
 * These stores already use appropriate keyPaths and do not need migration.
 *
 * @type {string[]}
 */
export const UNCHANGED_STORES = [
  'cache_data',
  'startup_data',
  'current_active_terms',
  'core_members',
  'member_section',
];
