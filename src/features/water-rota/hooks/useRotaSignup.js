/**
 * Signup writes for the rota board: wraps rotaService.writeSignup with
 * per-session pending state, toasts, and a refresh after each write.
 *
 * @module useRotaSignup
 */

import { useCallback, useState } from 'react';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { notifyError, notifySuccess } from '../../../shared/utils/notifications.js';
import { writeSignup } from '../services/rotaService.js';
import { SIGNUP_STATUS } from '../services/rotaEncoding.js';

/**
 * Human label for a signup change, used in toasts.
 *
 * @param {string|null} status - New signup status
 * @returns {string} Toast message
 */
function successMessage(status) {
  if (status === SIGNUP_STATUS.IN) return 'You\'re in';
  if (status === SIGNUP_STATUS.BACKUP) return 'Added to the backup list';
  return 'Signup withdrawn';
}

/**
 * Perform signup changes against a loaded rota group. Pending state is keyed
 * on the session's column-name key (globally unique across every record in
 * the group), not its field id — field ids like "f_1" repeat across records,
 * so two same-fieldId sessions in different records must not cross-trigger
 * pending state. Each write routes to the session's own owning record
 * ({@link import('../utils/rotaDisplay.js').SessionView.record}) rather
 * than the group.
 *
 * @param {import('../services/rotaService.js').RotaGroup|null} rota - Loaded rota group
 * @param {{scoutid: string}|null} identity - Resolved member identity
 * @param {Function} refresh - Re-load the rota after a successful write
 * @returns {{setSignup: Function, pendingKey: string|null}} Signup API
 */
export function useRotaSignup(rota, identity, refresh) {
  const [pendingKey, setPendingKey] = useState(null);

  const setSignup = useCallback(
    async (session, status) => {
      if (!rota || !identity || !session) {
        return;
      }
      setPendingKey(session.key);
      try {
        await writeSignup({
          rota: session.record,
          fieldId: session.fieldId,
          scoutid: identity.scoutid,
          status,
          token: getToken(),
        });
        notifySuccess(successMessage(status));
        await refresh();
      } catch (error) {
        if (error?.code === 'NO_TOKEN' || error?.isTokenExpired === true) {
          notifyError('Your session has expired — sign in again to change your signup.');
        } else if (error?.code === 'WRITE_UNAVAILABLE') {
          notifyError(/blocked/i.test(error.message)
            ? 'OSM has temporarily blocked the app — try again later.'
            : 'You\'re offline — connect to change your signup.');
        } else {
          notifyError(`Signup failed: ${error.message}`);
        }
      } finally {
        setPendingKey(null);
      }
    },
    [rota, identity, refresh],
  );

  return { setSignup, pendingKey };
}
