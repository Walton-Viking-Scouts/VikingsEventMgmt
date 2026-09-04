/**
 * Anonymises raw OSM payment captures into committable test fixtures.
 *
 * Reads the raw `getSchemes` and `paymentStatus` responses captured from the
 * OSM UI (which contain real names, dates of birth and photo ids) and writes
 * anonymised copies into `src/features/subs/__fixtures__/`. Identifiers,
 * dates, amounts, statuses and scheme names are preserved so the fixtures
 * stay faithful to the real shapes the model code must handle.
 *
 * Usage: node scripts/anonymise-osm-fixture.mjs [schemesPath] [statusPath]
 *
 * @module anonymise-osm-fixture
 */

/* global process, structuredClone */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const defaultRawDir = resolve(repoRoot, '../scripts/out');
const outDir = resolve(repoRoot, 'src/features/subs/__fixtures__');

const nameAliases = new Map();
const scoutIds = new Map();
const userIds = new Map();

/**
 * Replaces an OSM user id (the `who` of a status entry) with a stable fake id.
 * '0' (system) is kept as is.
 *
 * @param {string|number} who - Raw OSM user id
 * @returns {string} Fake id, consistent for the same input
 */
function fakeUserId(who) {
  const raw = String(who ?? '0');
  if (raw === '0') return raw;
  if (!userIds.has(raw)) userIds.set(raw, String(800001 + userIds.size));
  return userIds.get(raw);
}

/**
 * Deterministic fake surname/forename for a real name value.
 *
 * @param {string} kind - Alias prefix, e.g. 'Member' or 'Person'
 * @param {*} value - Real name value from the capture
 * @returns {*} Stable alias for that value, or the value when not a string
 */
function alias(kind, value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }
  const key = `${kind}:${value}`;
  if (!nameAliases.has(key)) {
    nameAliases.set(key, `${kind}${nameAliases.size + 1}`);
  }
  return nameAliases.get(key);
}

/**
 * Deterministic fake scoutid for a real one, stable across every place the
 * id appears (member rows and status entries alike).
 *
 * @param {*} value - Real scoutid
 * @returns {*} Replacement scoutid, or the value when absent
 */
function fakeScoutId(value) {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  const key = String(value);
  if (!scoutIds.has(key)) {
    scoutIds.set(key, String(900001 + scoutIds.size));
  }
  return scoutIds.get(key);
}

/**
 * Deterministic fake GUID derived from an index.
 *
 * @param {number} index - Position of the record being anonymised
 * @returns {string} A GUID-shaped placeholder
 */
function fakeGuid(index) {
  const hex = String(index + 1).padStart(4, '0');
  return `00000000-0000-4000-8000-00000000${hex}`;
}

/**
 * Anonymises the getSchemes response: fake bank-account names, scrubbed
 * portal contact/charity fields, everything else preserved.
 *
 * @param {Object} raw - Raw getSchemes response
 * @returns {Object} Anonymised copy
 */
function anonymiseSchemes(raw) {
  const result = structuredClone(raw);
  result.bank_accounts = (result.bank_accounts ?? []).map((account, index) => ({
    ...account,
    name: `Account${index + 1}`,
  }));
  const portal = result.config?.portal;
  if (portal) {
    if ('emailAddress' in portal) portal.emailAddress = 'leaders@example.invalid';
    if ('emailAddressCopy' in portal) portal.emailAddressCopy = '';
    if ('charityName' in portal) portal.charityName = 'EXAMPLE SCOUT GROUP';
    if ('easyfundraising' in portal) portal.easyfundraising = 'https://example.invalid/cause';
    if ('personalDetailsHeader' in portal) portal.personalDetailsHeader = 'Example header text.';
  }
  return result;
}

/**
 * Anonymises the payload=1 paymentStatus response: fake member names, dates
 * of birth and photo ids, fake status author names, everything else kept.
 *
 * @param {Object} raw - Raw paymentStatus response
 * @returns {Object} Anonymised copy
 */
function anonymiseStatus(raw) {
  const result = structuredClone(raw);
  const members = result.data?.members ?? [];
  members.forEach((member, index) => {
    member.scoutid = fakeScoutId(member.scoutid);
    member.startdate = '2024-09-01';
    member.firstname = alias('Forename', member.firstname);
    member.lastname = alias('Member', member.lastname);
    member.dob = '2015-01-01';
    if (member.photo_guid) {
      member.photo_guid = fakeGuid(index);
    }
    for (const [key, value] of Object.entries(member)) {
      if (!/^\d+$/.test(key) || !value || !Array.isArray(value.status)) {
        continue;
      }
      value.status = value.status.map((entry) => ({
        ...entry,
        scoutid: fakeScoutId(entry.scoutid),
        firstname: alias('Author', entry.firstname),
        who: fakeUserId(entry.who),
      }));
    }
  });
  return result;
}

const [schemesArg, statusArg] = process.argv.slice(2);
const schemesPath = schemesArg ? resolve(schemesArg) : resolve(defaultRawDir, 'getSchemes');
const statusPath = statusArg ? resolve(statusArg) : resolve(defaultRawDir, 'paymentStatus');

mkdirSync(outDir, { recursive: true });

const schemes = anonymiseSchemes(JSON.parse(readFileSync(schemesPath, 'utf8')));
const status = anonymiseStatus(JSON.parse(readFileSync(statusPath, 'utf8')));

writeFileSync(resolve(outDir, 'getSchemes.json'), `${JSON.stringify(schemes, null, 2)}\n`);
writeFileSync(resolve(outDir, 'paymentStatus.json'), `${JSON.stringify(status, null, 2)}\n`);

process.stdout.write(`Wrote anonymised fixtures to ${outDir}\n`);
