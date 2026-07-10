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
 * Perform signup changes against a loaded rota.
 *
 * @param {import('../services/rotaService.js').LoadedRota|null} rota - Loaded rota
 * @param {{scoutid: string}|null} identity - Resolved member identity
 * @param {Function} refresh - Re-load the rota after a successful write
 * @returns {{setSignup: Function, pendingFieldId: string|null}} Signup API
 */
export function useRotaSignup(rota, identity, refresh) {
  const [pendingFieldId, setPendingFieldId] = useState(null);

  const setSignup = useCallback(
    async (fieldId, status) => {
      if (!rota || !identity) {
        return;
      }
      setPendingFieldId(fieldId);
      try {
        await writeSignup({
          rota,
          fieldId,
          scoutid: identity.scoutid,
          status,
          token: getToken(),
        });
        notifySuccess(successMessage(status));
        await refresh();
      } catch (error) {
        if (error?.code === 'WRITE_UNAVAILABLE') {
          notifyError('You\'re offline — connect to change your signup.');
        } else {
          notifyError(`Signup failed: ${error.message}`);
        }
      } finally {
        setPendingFieldId(null);
      }
    },
    [rota, identity, refresh],
  );

  return { setSignup, pendingFieldId };
}
