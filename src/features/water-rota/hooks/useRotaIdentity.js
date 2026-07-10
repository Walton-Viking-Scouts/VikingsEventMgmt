/**
 * Resolves which host-section member row belongs to the current user, so
 * signups write to the right row.
 *
 * Resolution order: a previously confirmed choice (persisted per record) →
 * unique full-name match against the rota members → otherwise the caller
 * shows the identity picker. The chosen identity is stored per record id,
 * so a new year's rota re-resolves.
 *
 * @module useRotaIdentity
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeGetSessionItem } from '../../../shared/utils/storageUtils.js';
import { IndexedDBService } from '../../../shared/services/storage/indexedDBService.js';

/**
 * Best-effort current user full name from session auth info or cached
 * startup data (same sources as the sign-in feature).
 *
 * @returns {Promise<string|null>} "First Last", or null when unknown
 */
export async function getCurrentUserName() {
  const userInfo = safeGetSessionItem('user_info', {});
  if (userInfo.firstname && userInfo.lastname) {
    return `${userInfo.firstname} ${userInfo.lastname}`;
  }

  try {
    const startupData = await IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, 'viking_startup_data');
    const globals = startupData?.globals;
    if (globals?.firstname && globals?.lastname) {
      return `${globals.firstname} ${globals.lastname}`;
    }
  } catch {
    /* fall through to null — caller shows the picker */
  }
  return null;
}

/**
 * Storage key for the confirmed identity on one rota record.
 *
 * @param {string|number} recordId - FlexiRecord id
 * @returns {string} localStorage key
 */
function identityStorageKey(recordId) {
  return `viking_rota_identity_${recordId}`;
}

/**
 * Resolve the current user's member row in the rota host section.
 *
 * @param {import('../services/rotaService.js').LoadedRota|null} rota - Loaded rota (null while loading)
 * @returns {{identity: {scoutid: string, name: string}|null, needsPicker: boolean, resolving: boolean, choose: Function, clear: Function}} Identity state
 */
export function useRotaIdentity(rota) {
  const [state, setState] = useState({ identity: null, needsPicker: false, resolving: true });

  const members = useMemo(() => rota?.members ?? [], [rota]);
  const recordId = rota?.recordId;

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!recordId || members.length === 0) {
        setState({ identity: null, needsPicker: false, resolving: !recordId });
        return;
      }

      const storedId = localStorage.getItem(identityStorageKey(recordId));
      const stored = members.find((member) => member.scoutid === storedId);
      if (stored) {
        if (!cancelled) {
          setState({ identity: stored, needsPicker: false, resolving: false });
        }
        return;
      }

      const fullName = await getCurrentUserName();
      const matches = fullName
        ? members.filter((member) => member.name.toLowerCase() === fullName.toLowerCase())
        : [];

      if (!cancelled) {
        if (matches.length === 1) {
          localStorage.setItem(identityStorageKey(recordId), matches[0].scoutid);
          setState({ identity: matches[0], needsPicker: false, resolving: false });
        } else {
          setState({ identity: null, needsPicker: true, resolving: false });
        }
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [recordId, members]);

  const choose = useCallback(
    (scoutid) => {
      const member = members.find((entry) => entry.scoutid === String(scoutid));
      if (!member || !recordId) {
        return;
      }
      localStorage.setItem(identityStorageKey(recordId), member.scoutid);
      setState({ identity: member, needsPicker: false, resolving: false });
    },
    [members, recordId],
  );

  const clear = useCallback(() => {
    if (recordId) {
      localStorage.removeItem(identityStorageKey(recordId));
    }
    setState({ identity: null, needsPicker: true, resolving: false });
  }, [recordId]);

  return { ...state, choose, clear };
}
