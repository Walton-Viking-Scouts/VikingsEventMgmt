/**
 * Advisory gating for rota editing. OSM enforces flexi-record permissions
 * server-side; this only decides what UI to offer. We deny only when the
 * host section explicitly reports a flexi permission below write level —
 * an absent permission map errs open so a mis-shaped payload can't lock
 * every leader out of a feature OSM would have allowed.
 *
 * @module useRotaPermissions
 */

const FLEXI_WRITE_LEVEL = 20;

/**
 * Whether the user can edit the plan (setup wizard, session editing) on
 * the rota's host section.
 *
 * @param {Object|null|undefined} hostSection - Host section with a permissions map from getUserRoles
 * @returns {boolean} True when editing UI should be offered
 */
export function canEditRota(hostSection) {
  const flexi = hostSection?.permissions?.flexi;
  if (flexi === null || flexi === undefined) {
    return true;
  }
  return Number(flexi) >= FLEXI_WRITE_LEVEL;
}

/**
 * Hook form of canEditRota for component use.
 *
 * @param {import('../services/rotaService.js').LoadedRota|null} rota - Loaded rota
 * @returns {{canEdit: boolean}} Permission flags
 */
export function useRotaPermissions(rota) {
  return { canEdit: canEditRota(rota?.hostSection) };
}
