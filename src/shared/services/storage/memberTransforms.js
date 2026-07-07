/**
 * Shared member normalization/reconstruction used by BOTH storage backends.
 *
 * database.js previously carried two verbatim copies of this logic (one per
 * backend branch) — the drift machine behind past parity bugs. Both backends
 * MUST produce identical member shapes; keeping the transform in one place
 * makes that structural instead of disciplinary. SQLite-specific decoding
 * (JSON columns, 0/1 booleans) lives in the row adapters at the bottom.
 *
 * @module memberTransforms
 */

import { deriveBestPersonType } from '../../utils/personTypeDerivation.js';

const KNOWN_MEMBER_FIELDS = new Set([
  'scoutid', 'member_id', 'firstname', 'lastname', 'date_of_birth', 'age', 'age_years', 'age_months', 'yrs',
  'sectionid', 'sectionname', 'section', 'sections', 'patrol', 'patrol_id', 'person_type',
  'started', 'joined', 'end_date', 'active', 'photo_guid', 'has_photo', 'pic',
  'patrol_role_level', 'patrol_role_level_label', 'email', 'contact_groups', 'custom_data',
  'read_only', 'filter_string', '_filterString', 'sectionMemberships',
]);

function buildSectionRecord(scoutid, source, sectiontype) {
  return {
    scoutid,
    sectionid: Number(source.sectionid),
    person_type: deriveBestPersonType({
      sectiontype,
      attendee: source,
      existing: null,
    }),
    patrol: source.patrol,
    patrol_id: source.patrol_id,
    started: source.started,
    joined: source.joined,
    end_date: source.end_date,
    active: source.active,
    patrol_role_level: source.patrol_role_level,
    patrol_role_level_label: source.patrol_role_level_label,
    sectionname: source.sectionname,
    section: source.section,
  };
}

/**
 * Splits raw API member objects into deduplicated core-member records and
 * per-section membership records.
 *
 * @param {Array<Object>} members - Raw member objects from the API layer
 * @returns {{coreMembers: Array<Object>, sectionMembers: Array<Object>}}
 */
export function normalizeMembersForStorage(members) {
  const coreMemberMap = new Map();
  const sectionMembers = [];

  for (const member of members) {
    if (!member.scoutid && !member.member_id) {
      continue;
    }

    const scoutid = member.scoutid || member.member_id;

    const flattenedFields = {};
    Object.keys(member).forEach(key => {
      if (!KNOWN_MEMBER_FIELDS.has(key)) {
        flattenedFields[key] = member[key];
      }
    });

    const coreData = {
      scoutid,
      firstname: member.firstname,
      lastname: member.lastname,
      date_of_birth: member.date_of_birth,
      photo_guid: member.photo_guid,
      has_photo: member.has_photo,
      contact_groups: member.contact_groups || {},
      custom_data: member.custom_data || {},
      flattened_fields: flattenedFields,
      age: member.age,
      yrs: member.yrs,
      email: member.email,
      age_years: member.age_years,
      age_months: member.age_months,
      pic: member.pic,
      read_only: member.read_only,
      filter_string: member._filterString || member.filter_string,
    };

    if (!coreMemberMap.has(scoutid)) {
      coreMemberMap.set(scoutid, coreData);
    } else {
      const existing = coreMemberMap.get(scoutid);
      Object.keys(coreData).forEach(key => {
        if (key === 'contact_groups' || key === 'custom_data' || key === 'flattened_fields') {
          // Deep merge for these special fields
          existing[key] = { ...existing[key], ...coreData[key] };
        } else if (coreData[key] !== undefined) {
          existing[key] = coreData[key];
        }
        // If coreData[key] is undefined, keep existing value (accumulate from other sections)
      });
    }

    if (member.sectionMemberships && Array.isArray(member.sectionMemberships)) {
      member.sectionMemberships.forEach(sectionMembership => {
        sectionMembers.push(buildSectionRecord(scoutid, sectionMembership, sectionMembership.section));
      });
    } else if (member.sectionid) {
      sectionMembers.push(buildSectionRecord(scoutid, member, member.section));
    }
  }

  return { coreMembers: [...coreMemberMap.values()], sectionMembers };
}

/**
 * Rebuilds the app-facing member shape from a core record plus its section
 * memberships. Inputs must already be decoded (see the SQLite adapters).
 *
 * @param {Object} core - Core member record
 * @param {Object} sectionMember - Primary section membership record
 * @param {Array<Object>} allSections - All membership records for this scout
 * @returns {Object} App-facing member object
 */
export function reconstructMember(core, sectionMember, allSections) {
  return {
    scoutid: core.scoutid,
    member_id: core.scoutid,
    firstname: core.firstname ?? null,
    lastname: core.lastname ?? null,
    date_of_birth: core.date_of_birth ?? null,
    dateofbirth: core.date_of_birth ?? null,
    age: core.age ?? null,
    age_years: core.age_years || null,
    age_months: core.age_months || null,
    yrs: core.yrs ?? null,
    photo_guid: core.photo_guid ?? null,
    has_photo: core.has_photo ?? null,
    pic: core.pic ?? null,
    email: core.email ?? null,
    contact_groups: core.contact_groups || {},
    custom_data: core.custom_data || {},
    read_only: core.read_only || [],

    sectionid: sectionMember.sectionid ?? null,
    sectionname: sectionMember.sectionname ?? null,
    section: sectionMember.section ?? null,
    person_type: sectionMember.person_type ?? null,
    patrol: sectionMember.patrol ?? null,
    patrol_id: sectionMember.patrol_id ?? null,
    started: sectionMember.started ?? null,
    joined: sectionMember.joined ?? null,
    end_date: sectionMember.end_date ?? null,
    active: sectionMember.active ?? null,
    patrol_role_level: sectionMember.patrol_role_level ?? null,
    patrol_role_level_label: sectionMember.patrol_role_level_label ?? null,

    sections: allSections.map(s => ({
      section_id: s.sectionid,
      sectionid: s.sectionid,
      sectionname: s.sectionname,
      section: s.section,
      person_type: s.person_type,
      patrol: s.patrol,
      active: s.active,
    })),

    ...(typeof core.flattened_fields === 'object' && !Array.isArray(core.flattened_fields)
      ? core.flattened_fields
      : {}),
  };
}

/**
 * Groups membership records by scoutid and reconstructs one member per scout
 * (primary section = first membership encountered), sorted by name.
 *
 * @param {Map<*, Object>} coreMemberMap - scoutid -> decoded core record
 * @param {Array<Object>} sectionMemberships - Decoded membership records
 * @param {Function} onOrphan - Called with (scoutid, sectionid) when a
 *   membership has no core record
 * @returns {Array<Object>} App-facing member objects, name-sorted
 */
export function reconstructMembers(coreMemberMap, sectionMemberships, onOrphan) {
  const sectionsByScoutId = new Map();
  for (const section of sectionMemberships) {
    if (!sectionsByScoutId.has(section.scoutid)) {
      sectionsByScoutId.set(section.scoutid, []);
    }
    sectionsByScoutId.get(section.scoutid).push(section);
  }

  const members = [];
  const processedScoutIds = new Set();

  for (const sectionMember of sectionMemberships) {
    if (processedScoutIds.has(sectionMember.scoutid)) {
      continue;
    }
    processedScoutIds.add(sectionMember.scoutid);

    const core = coreMemberMap.get(sectionMember.scoutid);
    if (!core) {
      if (onOrphan) onOrphan(sectionMember.scoutid, sectionMember.sectionid);
      continue;
    }

    const allSections = sectionsByScoutId.get(sectionMember.scoutid) || [];
    members.push(reconstructMember(core, sectionMember, allSections));
  }

  members.sort((a, b) => {
    const lastNameCmp = (a.lastname || '').localeCompare(b.lastname || '');
    return lastNameCmp !== 0 ? lastNameCmp : (a.firstname || '').localeCompare(b.firstname || '');
  });

  return members;
}

function parseJsonColumn(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function intToBool(value) {
  return value === 1 ? true : (value === 0 ? false : null);
}

/**
 * Decodes a raw SQLite core_members row (JSON columns, 0/1 booleans) into
 * the shape reconstructMember expects.
 * @param {Object} row - Raw SQLite row
 * @returns {Object} Decoded core record
 */
export function adaptSqliteCoreRow(row) {
  return {
    ...row,
    has_photo: intToBool(row.has_photo),
    pic: intToBool(row.pic),
    contact_groups: parseJsonColumn(row.contact_groups, {}),
    custom_data: parseJsonColumn(row.custom_data, {}),
    read_only: parseJsonColumn(row.read_only, []),
    flattened_fields: parseJsonColumn(row.flattened_fields, {}),
  };
}

/**
 * Decodes a raw SQLite member_section row (0/1 booleans) into the shape
 * reconstructMember expects.
 * @param {Object} row - Raw SQLite row
 * @returns {Object} Decoded membership record
 */
export function adaptSqliteSectionRow(row) {
  return {
    ...row,
    active: intToBool(row.active),
  };
}
