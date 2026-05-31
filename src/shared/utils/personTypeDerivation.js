/**
 * @file personTypeDerivation — pure helpers for classifying a Scout member's
 *   `person_type` ('Young People' | 'Young Leaders' | 'Leaders') from any
 *   combination of available signals.
 *
 * The signals, in roughly descending order of confidence:
 *   1. Section type — `sectiontype === 'adults'` means everyone in that
 *      section is a Leader. Authoritative.
 *   2. Patrol ID — OSM uses -2 for the Leaders' patrol and -3 for the Young
 *      Leaders' patrol, by convention.
 *   3. Age — anyone "25+" or with a numeric year >= 18 is a Leader.
 *
 * The "self-perpetuating YP fallback" bug (#206) is what this helper exists to
 * avoid: when no signal was available on first sync, the old code defaulted
 * to 'Young People' and then trusted that stored value forever, even after
 * better signals arrived later. `deriveBestPersonType` is the resolver that
 * trusts fresh signals over the cached default.
 */

/**
 * @param {string|null|undefined} sectiontype - e.g. 'adults', 'beavers', 'cubs'
 * @returns {'Leaders'|null}
 */
export function mapSectionTypeToPersonType(sectiontype) {
  if (sectiontype && String(sectiontype).toLowerCase() === 'adults') {
    return 'Leaders';
  }
  return null;
}

/**
 * @param {number|string|null|undefined} patrolId
 * @returns {'Leaders'|'Young Leaders'|'Young People'|null}
 */
export function mapPatrolIdToPersonType(patrolId) {
  if (patrolId === null || patrolId === undefined || patrolId === '') return null;
  const id = Number(patrolId);
  if (!Number.isFinite(id)) return null;
  if (id === -2) return 'Leaders';
  if (id === -3) return 'Young Leaders';
  if (id > 0) return 'Young People';
  return null;
}

/**
 * @param {string|null|undefined} age - OSM "yrs / months", or "25+", or plain int
 * @returns {'Leaders'|'Young People'|null}
 */
export function derivePersonTypeFromAge(age) {
  if (age === null || age === undefined || age === '') return null;
  const str = String(age);
  if (str === '25+') return 'Leaders';
  const match = str.match(/^(\d+)/);
  if (match) {
    const years = parseInt(match[1], 10);
    if (years >= 18) return 'Leaders';
    return 'Young People';
  }
  return null;
}

/**
 * Combine all signals to pick the best person_type.
 *
 * Resolution order (first non-null wins):
 *   1. Section type — `'adults'` ⇒ 'Leaders' (authoritative).
 *   2. Fresh derivations from patrol_id + age on the current attendee row.
 *   3. Existing stored person_type (only trusted when not the YP default,
 *      since the YP fallback is what we're trying to avoid perpetuating).
 *   4. attendee.person_type (rarely populated by the events API).
 *   5. Final fallback: 'Young People'.
 *
 * Step 3 is the subtle one: we DO trust an existing value of 'Leaders' or
 * 'Young Leaders' (someone explicitly set those), but we do NOT trust an
 * existing 'Young People' value if fresh signals disagree — because 'Young
 * People' is also the silent default and we can't tell which.
 *
 * @param {Object} args
 * @param {string|null|undefined} args.sectiontype - From sections cache
 * @param {Object|null|undefined} args.attendee - Row from the attendance API
 * @param {Object|null|undefined} args.existing - Stored member_section row, if any
 * @returns {string} 'Young People' | 'Young Leaders' | 'Leaders'
 */
export function deriveBestPersonType({ sectiontype, attendee, existing }) {
  const fromSectionType = mapSectionTypeToPersonType(sectiontype);
  if (fromSectionType) return fromSectionType;

  const fromPatrolId = mapPatrolIdToPersonType(attendee?.patrol_id ?? attendee?.patrolid);
  const fromAge = derivePersonTypeFromAge(attendee?.age ?? attendee?.yrs);

  const trustExisting =
    existing?.person_type &&
    existing.person_type !== 'Young People';
  if (trustExisting) return existing.person_type;

  if (fromPatrolId === 'Leaders' || fromPatrolId === 'Young Leaders') return fromPatrolId;
  if (fromAge === 'Leaders') return fromAge;
  if (fromPatrolId) return fromPatrolId;
  if (fromAge) return fromAge;

  if (attendee?.person_type) return attendee.person_type;
  if (existing?.person_type) return existing.person_type;

  return 'Young People';
}
