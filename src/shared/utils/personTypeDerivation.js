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
 * This helper exists to avoid a class of bug where a default 'Young People'
 * value gets cached and then re-trusted as if it were a real signal: on
 * first sync we have no age/patrol/section info, so we default to 'Young
 * People'; on later syncs we look at the stored value and see 'Young
 * People', so we keep it — even when age data has since arrived saying
 * otherwise. `deriveBestPersonType` distrusts the YP default specifically
 * (other explicitly-stored values like 'Leaders' are still honoured). See
 * #206 for the original incident report.
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
 * @returns {'Leaders'|'Young Leaders'|'Young People'|null} `null` when the
 *   input is missing or not a finite number, OR when it is `0` (OSM doesn't
 *   use 0 as a valid patrol id, so we treat it as "no signal" rather than
 *   guessing 'Young People' from a positive-id default).
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
 * @returns {'Leaders'|'Young People'|null} `null` when the input is missing,
 *   empty, or doesn't start with a digit (e.g. 'N/A', 'unknown').
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
 * Resolution order (matches the function body, top-down):
 *   1. Section type — `'adults'` ⇒ 'Leaders' (authoritative).
 *   2. Existing stored person_type — but only when it is NOT the literal
 *      string 'Young People'. The reasoning: a stored 'Leaders' or 'Young
 *      Leaders' was set explicitly (either by an OSM API field or by a
 *      previous patrol_id/age derivation) and is more reliable than fresh
 *      signals; but a stored 'Young People' is indistinguishable from the
 *      final fallback default, so we mistrust it and look at fresh signals.
 *   3. Fresh patrol_id mapping — `-2` ⇒ 'Leaders', `-3` ⇒ 'Young Leaders'
 *      take precedence; a positive patrol_id (which maps to 'Young People')
 *      is held in reserve so it doesn't outrank age-derived 'Leaders'.
 *   4. Fresh age-based derivation — `'25+'` or `>= 18` ⇒ 'Leaders'.
 *   5. Held-back patrol_id 'Young People' (positive patrol id).
 *   6. Held-back age 'Young People' (`< 18`).
 *   7. attendee.person_type (rarely populated by the events API).
 *   8. Last-resort fallback: 'Young People'.
 *
 * The "trust existing non-YP value, distrust existing 'Young People'" rule
 * in step 2 is what fixes #206: the old inline code at all four writer call
 * sites trusted any existing value, so once a member was wrongly classified
 * 'Young People' (typically on first sync when no age was present), no later
 * fresh signal could ever overwrite it.
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
