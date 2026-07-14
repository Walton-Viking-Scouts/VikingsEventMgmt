/**
 * Pure plan-building helpers for the Water Session Permit Rota setup and sync.
 * Kept out of the wizard component so they can be unit-tested directly and to
 * keep the component file component-only (React fast-refresh).
 *
 * @module rotaSetupPlan
 */

import { buildSessionColumnName } from '../services/rotaEncoding.js';

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
