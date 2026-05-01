/**
 * Detect which sections are missing one of the required FlexiRecords.
 *
 * Runs both validators (Movers + Event Mgmt) for every section the caller
 * cares about, then collects the gaps into a single structure the banner and
 * modal both consume.
 *
 * Adults/waitinglist sections are excluded — they don't use either FlexiRecord.
 *
 * @module useMissingFlexiRecords
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { fetchMostRecentTermId } from '../../../shared/services/api/api/terms.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { validateVikingSectionMoversFlexiRecord } from '../../movements/services/vikingSectionMoversValidation.js';
import { validateVikingEventMgmtFlexiRecord } from '../services/vikingEventMgmtValidation.js';
import {
  VIKING_SECTION_MOVERS,
  VIKING_EVENT_MGMT,
} from '../services/flexiRecordTemplates.js';

/**
 * @typedef {Object} MissingRecord
 * @property {import('../services/flexiRecordTemplates.js').FlexiRecordTemplate} template
 * @property {'absent'|'incomplete'} reason
 * @property {string[]} missingFields - Names of template fields that are missing
 */

/**
 * @typedef {Object} SectionGap
 * @property {{ sectionid: string|number, sectionname: string }} section
 * @property {string|number|null} termId - Most-recent term ID for the section (or null if lookup failed)
 * @property {MissingRecord[]} missingRecords
 */

const TEMPLATES_BY_NAME = {
  [VIKING_SECTION_MOVERS.name]: VIKING_SECTION_MOVERS,
  [VIKING_EVENT_MGMT.name]: VIKING_EVENT_MGMT,
};

const VALIDATORS = [
  { template: VIKING_SECTION_MOVERS, validate: validateVikingSectionMoversFlexiRecord },
  { template: VIKING_EVENT_MGMT, validate: validateVikingEventMgmtFlexiRecord },
];

/**
 * True when a section is one that uses the Movers / Event Mgmt FlexiRecords.
 *
 * Adults and waiting-list sections never use either record. An empty/missing
 * section name is treated as non-operational so callers don't get a false
 * positive on synthetic placeholders.
 *
 * Exported so call-sites that decide whether to render the banner UI use the
 * exact same logic the hook uses internally — keeping parent and hook in sync.
 *
 * @param {{ sectionname?: string, name?: string }} section
 * @returns {boolean}
 */
export function isOperationalSection(section) {
  const name = (section?.sectionname || section?.name || '').toLowerCase();
  if (!name) return false;
  return !(name.includes('adults') || name.includes('waiting') || name.includes('waitinglist'));
}

/**
 * Convert a validator result into a MissingRecord (or null if nothing missing).
 *
 * Network errors are treated as "unknown — don't surface": we'd rather hide the
 * banner for a section we couldn't check than wrongly tell the user their record
 * is missing when really OSM was just unreachable.
 *
 * @param {Object} validation - Result from one of the validators
 * @param {import('../services/flexiRecordTemplates.js').FlexiRecordTemplate} template
 * @returns {MissingRecord|null}
 */
function toMissingRecord(validation, template) {
  if (validation.networkError) return null;
  if (validation.isValid) return null;

  if (!validation.hasFlexiRecord) {
    return {
      template,
      reason: 'absent',
      missingFields: [...template.fields],
    };
  }

  const missingFieldNames = (validation.missingFields || []).map(f => f.fieldName);
  if (missingFieldNames.length === 0) {
    return null;
  }

  return {
    template,
    reason: 'incomplete',
    missingFields: missingFieldNames,
  };
}

/**
 * Hook: discover which sections are missing required FlexiRecords.
 *
 * The returned `refresh` always force-refreshes the underlying validators so the
 * banner reflects current OSM state after a successful create — independent of
 * whether the creation service's best-effort cache prime succeeded.
 *
 * @param {Array} sections - Section objects (from databaseService.getSections)
 * @returns {{ loading: boolean, missing: SectionGap[], refresh: () => Promise<void> }}
 */
export default function useMissingFlexiRecords(sections) {
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState([]);

  // Stabilise the sections list across renders so detect() doesn't re-fire on
  // every render of a parent that creates a fresh array literal each time.
  const sectionKey = (sections || [])
    .map(s => `${s?.sectionid ?? ''}::${s?.sectionname ?? s?.name ?? ''}`)
    .join('|');

  const stableSections = useMemo(() => sections || [], [sectionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const detect = useCallback(async (forceRefresh = false) => {
    if (!stableSections || stableSections.length === 0) {
      setMissing([]);
      return;
    }

    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        logger.info('useMissingFlexiRecords: no token, skipping detection', {}, LOG_CATEGORIES.APP);
        setMissing([]);
        return;
      }

      const operational = stableSections.filter(isOperationalSection);
      const gaps = [];

      for (const section of operational) {
        const sectionId = section.sectionid;
        let termId;
        try {
          termId = await fetchMostRecentTermId(sectionId, token);
        } catch (error) {
          logger.warn('useMissingFlexiRecords: termId lookup failed', {
            sectionId,
            error: error.message,
          }, LOG_CATEGORIES.APP);
          continue;
        }
        if (!termId) continue;

        const settled = await Promise.allSettled(
          VALIDATORS.map(async ({ template, validate }) => ({
            template,
            validation: await validate(sectionId, termId, token, forceRefresh),
          })),
        );

        const missingRecords = settled.flatMap(result => {
          if (result.status !== 'fulfilled') {
            logger.warn('useMissingFlexiRecords: validator failed for a section, continuing with rest', {
              sectionId,
              error: result.reason?.message ?? String(result.reason),
            }, LOG_CATEGORIES.APP);
            return [];
          }
          const missing = toMissingRecord(result.value.validation, result.value.template);
          return missing ? [missing] : [];
        });

        if (missingRecords.length > 0) {
          gaps.push({
            section: {
              sectionid: sectionId,
              sectionname: section.sectionname || section.name || 'Unknown Section',
            },
            termId,
            missingRecords,
          });
        }
      }

      setMissing(gaps);
    } finally {
      setLoading(false);
    }
  }, [stableSections]);

  useEffect(() => {
    detect(false);
  }, [detect]);

  const refresh = useCallback(() => detect(true), [detect]);

  return { loading, missing, refresh };
}

export { TEMPLATES_BY_NAME };
