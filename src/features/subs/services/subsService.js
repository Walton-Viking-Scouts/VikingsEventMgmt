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

import { getPaymentSchemes, getPaymentStatus } from '../../../shared/services/api/api/index.js';
import databaseService from '../../../shared/services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { buildSectionSubsSummary, deriveTerms } from './subsModel.js';

const MIN_FINANCE_PERMISSION = 10;

const inFlight = new Map();

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
    || error?.status === 401;
  const wrapped = new Error(`${message}: ${error?.message ?? 'unknown error'}`);
  wrapped.cause = error;
  wrapped.needsAuth = isAuthError;
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
 * @returns {Promise<Array<{sectionId: string, sectionName: string, financePermission: number, canView: boolean}>>} All cached sections
 */
export async function getSubsSections() {
  const sections = (await databaseService.getSections()) ?? [];
  return sections.map((section) => {
    const financePermission = Number(section.permissions?.finance ?? 0);
    return {
      sectionId: String(section.sectionid),
      sectionName: section.sectionname ?? `Section ${section.sectionid}`,
      financePermission,
      canView: financePermission >= MIN_FINANCE_PERMISSION,
    };
  });
}

/**
 * Loads one section's subs summary: the scheme list, then one payment-status
 * call per subs scheme (`require_all === 1`) for the section's current term,
 * one at a time. Stops on the first failure.
 *
 * @param {string|number} sectionId - Section to load
 * @param {Object} options - Load options
 * @param {string} options.token - OSM authentication token
 * @param {boolean} [options.forceRefresh=false] - Bypass the 30 minute cache
 * @returns {Promise<Object>} SectionSubsSummary
 * @throws {Error} With `needsAuth === true` for 401/expired-token failures,
 *   otherwise a plain Error with a readable message
 */
export function loadSectionSubs(sectionId, { token, forceRefresh = false } = {}) {
  // React StrictMode mounts hooks twice: without this, one page mount sends
  // two identical bursts of payment calls at OSM.
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
  const sections = (await databaseService.getSections()) ?? [];
  const section = sections.find((s) => String(s.sectionid) === String(sectionId));
  if (!section) {
    throw new Error(`Unknown section ${sectionId} — refresh the app data first`);
  }
  const sectionName = section.sectionname ?? `Section ${sectionId}`;
  if (Number(section.permissions?.finance ?? 0) < MIN_FINANCE_PERMISSION) {
    throw new Error(`No finance access for ${sectionName}`);
  }

  const sectionTerms = (await databaseService.getTerms(sectionId)) ?? [];
  const terms = deriveTerms(sectionTerms, today);
  if (!terms.current) {
    throw new Error(`No current term is cached for ${sectionName} — refresh the app data first`);
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

  if (!schemesResponse) {
    throw new Error('Subs are not available in demo mode');
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
    terms,
    today,
    loadedAt,
    fromCache,
  });
}
