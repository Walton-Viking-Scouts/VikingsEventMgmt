/**
 * Required FlexiRecord templates for the Viking Event Mgmt app.
 *
 * Each template defines the OSM FlexiRecord name and the custom fields the app
 * needs to be present on it. Field names must match exactly what the existing
 * validators check for (vikingSectionMoversValidation.js, signInDataService.js)
 * so a record created from these templates passes validation immediately.
 *
 * createOptions controls the OSM auto-fields (DOB, Age, Patrol). We disable them
 * so the FlexiRecord starts with only our custom columns.
 *
 * @module flexiRecordTemplates
 */

/**
 * @typedef {Object} FlexiRecordTemplate
 * @property {string} name - Exact OSM FlexiRecord name (used for lookup and creation)
 * @property {string[]} fields - Field/column names to ensure exist on the record
 * @property {Object} createOptions - Options forwarded to createFlexiRecord
 * @property {string} createOptions.dob - '0' or '1'
 * @property {string} createOptions.age - '0' or '1'
 * @property {string} createOptions.patrol - '0' or '1'
 * @property {string} createOptions.type - OSM record type (default 'none')
 * @property {string} description - Short user-facing description for the modal
 */

/** @type {FlexiRecordTemplate} */
export const VIKING_SECTION_MOVERS = {
  name: 'Viking Section Movers',
  fields: [
    'AssignedSection',
    'AssignedTerm',
    'AssignmentOverride',
    'AssignmentDate',
    'AssignedBy',
  ],
  createOptions: { dob: '0', age: '0', patrol: '0', type: 'none' },
  description: 'Tracks section assignments for the Movements feature.',
};

/** @type {FlexiRecordTemplate} */
export const VIKING_EVENT_MGMT = {
  name: 'Viking Event Mgmt',
  fields: [
    'SignedInBy',
    'SignedInWhen',
    'SignedOutBy',
    'SignedOutWhen',
    'CampGroup',
  ],
  createOptions: { dob: '0', age: '0', patrol: '0', type: 'none' },
  description: 'Stores sign-in / sign-out data and camp group assignments for events.',
};

/**
 * Ordered list of all FlexiRecord templates the app requires per section.
 * Iteration order is preserved by callers — keep the most user-visible record first.
 *
 * @type {FlexiRecordTemplate[]}
 */
export const REQUIRED_FLEXI_RECORDS = [VIKING_SECTION_MOVERS, VIKING_EVENT_MGMT];
