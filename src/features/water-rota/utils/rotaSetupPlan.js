/**
 * Pure plan-building helpers for the Water Session Permit Rota setup and sync.
 * Kept out of the wizard component so they can be unit-tested directly and to
 * keep the component file component-only (React fast-refresh).
 *
 * @module rotaSetupPlan
 */

import { buildSessionColumnName, parseSessionColumnName } from '../services/rotaEncoding.js';

/**
 * Earlier of two yyyy-mm-dd date strings, ignoring null/undefined.
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {string|undefined}
 */
function earlier(a, b) {
  if (!a) return b || undefined;
  if (!b) return a;
  return a <= b ? a : b;
}

/**
 * Later of two yyyy-mm-dd date strings, ignoring null/undefined.
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {string|undefined}
 */
function later(a, b) {
  if (!a) return b || undefined;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Merge one setup run's sections into the shared rota config without disturbing
 * the sections it didn't touch. Section leaders set up their own section, so a
 * save must NEVER replace the whole config (which would delete every other
 * leader's section). Only the sections in `patch` are rewritten; the rota-wide
 * date range grows to cover the patch (union), so each section extends it.
 *
 * @param {Object|null|undefined} base - Live shared config ({start,end,sections,sessions})
 * @param {{sections?: Array<{sid: string}>, sessions?: Object, start?: string, end?: string}} patch - This run's data
 * @returns {Object} Merged config
 */
export function mergeSectionConfig(base, patch) {
  const baseCfg = base ?? {};
  const p = patch ?? {};
  const touched = new Set((p.sections ?? []).map((s) => String(s.sid)));

  // Sections: keep untouched sections, replace/add the touched ones.
  const sections = [
    ...(baseCfg.sections ?? []).filter((s) => !touched.has(String(s.sid))),
    ...(p.sections ?? []),
  ];

  // Sessions: drop the touched sections' old overrides (this run redefines
  // them), keep every other section's, then add this run's.
  const sessions = {};
  for (const [col, override] of Object.entries(baseCfg.sessions ?? {})) {
    const parsed = parseSessionColumnName(col);
    if (parsed && touched.has(String(parsed.sectionId))) {
      continue;
    }
    sessions[col] = override;
  }
  Object.assign(sessions, p.sessions ?? {});

  return {
    ...baseCfg,
    start: earlier(baseCfg.start, p.start),
    end: later(baseCfg.end, p.end),
    sections,
    sessions,
  };
}

/**
 * Build the per-session config map from all generated descriptors: water
 * sessions carry activity/time overrides (only fields differing from the
 * section default); not-on-water weeks carry {c:1} so they show greyed
 * without needing a FlexiRecord column. Every session stores its programme
 * meeting title (`pt`) so the board shows the real name rather than a guessed
 * water-activity preset. Keyed by session column name.
 *
 * @param {Array} descriptors - All session descriptors (each with an onWater flag)
 * @param {Array<{sid: string, act: string, st: string, en: string}>} sectionDefaults - Config section defaults
 * @returns {Object} Map of column name to override object
 */
export function buildSessionOverrides(descriptors, sectionDefaults) {
  const defaultsBySid = new Map(sectionDefaults.map((entry) => [String(entry.sid), entry]));
  const overrides = {};
  for (const descriptor of descriptors) {
    const key = buildSessionColumnName(descriptor.date, descriptor.sectionId);
    const title = descriptor.title || null;
    if (descriptor.onWater === false) {
      overrides[key] = title ? { c: 1, pt: title } : { c: 1 };
      continue;
    }
    const base = defaultsBySid.get(String(descriptor.sectionId));
    const override = {};
    if (title) {
      override.pt = title;
    }
    if (descriptor.activity && descriptor.activity !== base?.act) {
      override.act = descriptor.activity;
    }
    if (descriptor.startTime && descriptor.startTime !== base?.st) {
      override.st = descriptor.startTime;
    }
    if (descriptor.endTime && descriptor.endTime !== base?.en) {
      override.en = descriptor.endTime;
    }
    if (Object.keys(override).length > 0) {
      overrides[key] = override;
    }
  }
  return overrides;
}
