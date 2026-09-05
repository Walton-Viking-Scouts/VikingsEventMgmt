/**
 * Subs monitoring data service: composes the cached sections, members and
 * terms with the OSM payments endpoints into a SectionSubsSummary.
 *
 * OSM is sensitive to bad payment calls, so a load makes the minimum number
 * of requests — one scheme list, then one status call per subs scheme for the
 * current term, strictly sequentially — and stops on the first failure with
 * no retry and no fallback to the next scheme.
 *
 * @module subsService
 */

import { getPaymentSchemes, getPaymentStatus, getTerms } from '../../../shared/services/api/api/index.js';
import databaseService from '../../../shared/services/storage/database.js';
import { CurrentActiveTermsService } from '../../../shared/services/storage/currentActiveTermsService.js';
import { authHandler } from '../../../shared/services/auth/authHandler.js';
import { isDemoMode } from '../../../config/demoMode.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { buildSectionSubsSummary, deriveTerms, mostRecentTerm } from './subsModel.js';

const MIN_FINANCE_PERMISSION = 10;

const inFlight = new Map();

const TERMS_TTL = 30 * 60 * 1000;

let termsCache = null;

/**
 * Discards the shared terms payload so the next load fetches it again. Only
 * `forceRefresh` and the tests use this; nothing wires it to sign-out.
 *
 * @returns {void}
 */
export function resetTermsCache() {
  termsCache = null;
}

/**
 * The full terms payload, keyed by section id string. getTerms has no cache
 * of its own and always hits the network, so every section in a summary run
 * shares one fetch. A rejection is shared too — the same rejected promise is
 * handed to the remaining sections, so a failing run calls getTerms exactly
 * once instead of retrying per section; only forceRefresh or
 * {@link resetTermsCache} clears it.
 *
 * @param {string} token - OSM authentication token
 * @param {boolean} forceRefresh - Discard the shared payload first
 * @returns {Promise<Object>} Terms keyed by section id
 * @throws {Error} Whatever getTerms threw, unchanged
 */
function loadAllTerms(token, forceRefresh) {
  if (forceRefresh || (termsCache && Date.now() - termsCache.at > TERMS_TTL)) {
    termsCache = null;
  }
  if (!termsCache) {
    const promise = getTerms(token, forceRefresh);
    promise.catch(() => undefined);
    termsCache = { at: Date.now(), promise };
  }
  return termsCache.promise;
}

/**
 * Resolves the section's term buckets. The app's own current-active-term
 * record wins outright when present: it IS the current term, even if another
 * cached term overlaps today or the record's own dates, and previous/next are
 * then derived around it. A term missing from the cached list is rebuilt from
 * the record's own fields. Without a record, the date-based derivation in
 * {@link deriveTerms} decides.
 *
 * @param {string} sectionId - Section id
 * @param {string} sectionName - Section display name, for error messages
 * @param {Array<Object>} sectionTerms - The section's cached terms
 * @param {string} today - Today's date (yyyy-mm-dd)
 * @returns {Promise<{previous: Object|null, current: Object|null, next: Object|null}>} Term buckets
 * @throws {Error} localOnly NO_CURRENT_TERM when the record cannot be read
 */
async function resolveTerms(sectionId, sectionName, sectionTerms, today) {
  let activeRecord = null;
  try {
    activeRecord = await CurrentActiveTermsService.getCurrentActiveTerm(String(sectionId));
  } catch (error) {
    throw localError(
      'NO_CURRENT_TERM',
      `Could not read the current term for ${sectionName}: ${error.message}`,
    );
  }

  const currentTermId = activeRecord?.currentTermId;
  if (!currentTermId) {
    return deriveTerms(sectionTerms, today);
  }

  const match = sectionTerms.find((term) => String(term?.termid) === String(currentTermId));
  const pinned = match ?? {
    termid: currentTermId,
    name: activeRecord.termName,
    startdate: activeRecord.startDate,
    enddate: activeRecord.endDate,
  };
  const others = sectionTerms.filter((term) => String(term?.termid) !== String(currentTermId));
  const derived = deriveTerms([pinned, ...others], pinned.startdate);
  const current = normalisePinnedTerm(pinned) ?? derived.current;
  return {
    previous: derived.previous?.termId === current?.termId ? null : derived.previous,
    current,
    next: derived.next?.termId === current?.termId ? null : derived.next,
  };
}

/**
 * The pinned current-active term in SubsTerm shape.
 *
 * @param {Object} term - OSM term row
 * @returns {{termId: string, name: string, startDate: string, endDate: string}|null} Normalised term
 */
function normalisePinnedTerm(term) {
  if (!term?.startdate || !term?.enddate) {
    return null;
  }
  return {
    termId: String(term.termid),
    name: term.name ?? '',
    startDate: String(term.startdate),
    endDate: String(term.enddate),
  };
}

/**
 * Today's date as yyyy-mm-dd in local time.
 *
 * @param {Date} [now=new Date()] - Clock, injectable for tests
 * @returns {string} Today's date
 */
function todayISO(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Builds an error for a condition detected locally, before any network call.
 * `localOnly` lets the summary page skip the section and carry on rather
 * than treating it as an OSM failure that must stop the whole run.
 *
 * @param {'UNKNOWN_SECTION'|'NO_ACCESS'|'NO_CURRENT_TERM'|'DEMO_MODE'} code - Failure kind
 * @param {string} message - Readable message
 * @returns {Error} The error to throw
 */
function localError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.localOnly = true;
  error.needsAuth = false;
  return error;
}

/**
 * Wraps a load failure in the error shape the pages expect: `needsAuth` for
 * 401 / expired-token conditions, a readable Error otherwise.
 *
 * @param {Error} error - The originating failure
 * @param {string} message - Human-readable prefix
 * @returns {Error} The error to throw
 */
function loadError(error, message) {
  const isAuthError = error?.code === 'NO_TOKEN'
    || error?.isTokenExpired === true
    || error?.status === 401
    || authHandler.hasAuthFailed();
  const wrapped = new Error(`${message}: ${error?.message ?? 'unknown error'}`);
  wrapped.cause = error;
  wrapped.needsAuth = isAuthError;
  wrapped.code = isAuthError ? 'NEEDS_AUTH' : 'LOAD_FAILED';
  wrapped.localOnly = false;
  if (isAuthError) {
    wrapped.status = 401;
  }
  return wrapped;
}

/**
 * Every cached section, in store order, with its finance permission and
 * whether that permission allows viewing subs. Sections the user cannot view
 * are still returned so the summary page can list them greyed out; they are
 * never loaded.
 *
 * A section whose cached row carries no permissions map at all has not had
 * its permissions synced (an old row, or a dropped parse); it reports
 * `permissionsSynced: false` so the page can ask for a data refresh rather
 * than claiming the user has no finance access.
 *
 * @returns {Promise<Array<{sectionId: string, sectionName: string, financePermission: number, canView: boolean, permissionsSynced: boolean}>>} All cached sections
 */
export async function getSubsSections() {
  const sections = (await databaseService.getSections()) ?? [];
  return sections.map((section) => {
    const permissionsSynced = Boolean(section.permissions) && typeof section.permissions === 'object';
    const financePermission = permissionsSynced ? Number(section.permissions.finance ?? 0) : 0;
    return {
      sectionId: String(section.sectionid),
      sectionName: section.sectionname ?? `Section ${section.sectionid}`,
      financePermission,
      canView: permissionsSynced && financePermission >= MIN_FINANCE_PERMISSION,
      permissionsSynced,
    };
  });
}

/**
 * Loads one section's subs summary: the scheme list, then one payment-status
 * call per subs scheme (`require_all === 1`) for the section's current term,
 * one at a time. Stops on the first failure, with no stale-cache fallback.
 *
 * Concurrent calls for the same section and forceRefresh share one load, so
 * a StrictMode double mount sends a single burst of payment calls.
 *
 * @param {string|number} sectionId - Section to load
 * @param {Object} options - Load options
 * @param {string} options.token - OSM authentication token
 * @param {boolean} [options.forceRefresh=false] - Bypass the 30 minute cache
 * @returns {Promise<Object>} SectionSubsSummary
 * @throws {Error} Always carrying `code` ('UNKNOWN_SECTION', 'NO_ACCESS',
 *   'NO_CURRENT_TERM', 'DEMO_MODE', 'NEEDS_AUTH' or 'LOAD_FAILED'),
 *   `localOnly` (true when detected before any network call, so the caller
 *   may skip this section and continue) and `needsAuth` (true only for
 *   'NEEDS_AUTH', which also sets `status` 401). Network failures carry the
 *   originating error as `cause`.
 */
export function loadSectionSubs(sectionId, { token, forceRefresh = false } = {}) {
  const key = `${sectionId}|${forceRefresh ? '1' : '0'}`;
  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }
  const run = runSectionSubsLoad(sectionId, { token, forceRefresh })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, run);
  return run;
}

/**
 * Performs the actual load for {@link loadSectionSubs}.
 *
 * @param {string|number} sectionId - Section to load
 * @param {Object} options - Load options
 * @param {string} options.token - OSM authentication token
 * @param {boolean} options.forceRefresh - Bypass the 30 minute cache
 * @returns {Promise<Object>} SectionSubsSummary
 */
async function runSectionSubsLoad(sectionId, { token, forceRefresh }) {
  const today = todayISO();
  if (isDemoMode()) {
    throw localError('DEMO_MODE', 'Subs are not available in demo mode');
  }
  const sections = (await databaseService.getSections()) ?? [];
  const section = sections.find((s) => String(s.sectionid) === String(sectionId));
  if (!section) {
    throw localError('UNKNOWN_SECTION', `Unknown section ${sectionId} — refresh the app data first`);
  }
  const sectionName = section.sectionname ?? `Section ${sectionId}`;
  if (Number(section.permissions?.finance ?? 0) < MIN_FINANCE_PERMISSION) {
    throw localError('NO_ACCESS', `No finance access for ${sectionName}`);
  }

  let allTerms;
  try {
    allTerms = await loadAllTerms(token, forceRefresh);
  } catch (error) {
    logger.error('Subs: terms load failed', {
      sectionId,
      error: error.message,
    }, LOG_CATEGORIES.ERROR);
    throw loadError(error, `Could not load terms for ${sectionName}`);
  }
  const sectionTerms = allTerms?.[String(sectionId)] ?? [];
  if (sectionTerms.length === 0) {
    throw localError('NO_CURRENT_TERM', `No terms cached for ${sectionName} — refresh the app data first`);
  }
  const terms = await resolveTerms(sectionId, sectionName, sectionTerms, today);
  if (!terms.current) {
    const latest = mostRecentTerm(sectionTerms);
    throw localError(
      'NO_CURRENT_TERM',
      latest
        ? `No current term for ${sectionName} (last term ended ${latest.endDate})`
        : `No terms cached for ${sectionName}`,
    );
  }

  const members = (await databaseService.getMembers([Number(sectionId)])) ?? [];

  let schemesResponse;
  try {
    schemesResponse = await getPaymentSchemes(sectionId, token, { forceRefresh });
  } catch (error) {
    logger.error('Subs: payment scheme load failed', {
      sectionId,
      error: error.message,
    }, LOG_CATEGORIES.ERROR);
    throw loadError(error, `Could not load payment schemes for ${sectionName}`);
  }

  const subsSchemes = (schemesResponse.items ?? []).filter((scheme) => Number(scheme.require_all) === 1);

  const statusResponses = {};
  const timestamps = [];
  let fromCache = false;

  if (schemesResponse._cacheTimestamp) {
    fromCache = true;
    timestamps.push(schemesResponse._cacheTimestamp);
  }

  for (const scheme of subsSchemes) {
    let statusResponse;
    try {
      statusResponse = await getPaymentStatus(
        sectionId,
        scheme.schemeid,
        terms.current.termId,
        token,
        { forceRefresh },
      );
    } catch (error) {
      logger.error('Subs: payment status load failed', {
        sectionId,
        schemeId: scheme.schemeid,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      throw loadError(error, `Could not load payment status for ${scheme.name ?? 'scheme'} in ${sectionName}`);
    }
    statusResponses[String(scheme.schemeid)] = statusResponse;
    if (statusResponse?._cacheTimestamp) {
      fromCache = true;
      timestamps.push(statusResponse._cacheTimestamp);
    }
  }

  const loadedAt = timestamps.length === subsSchemes.length + 1 && timestamps.length > 0
    ? Math.max(...timestamps)
    : Date.now();

  return buildSectionSubsSummary({
    sectionId,
    sectionName,
    schemesResponse,
    statusResponses,
    members,
    cachedMemberCount: members.length,
    terms,
    today,
    loadedAt,
    fromCache,
  });
}
