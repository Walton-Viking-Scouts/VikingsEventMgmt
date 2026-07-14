/**
 * Resolves which host-section member row belongs to the current user, so
 * signups write to the right row.
 *
 * Resolution order: a previously confirmed choice (persisted per host
 * section) → unique full-name match against the rota members → otherwise
 * the caller shows the identity picker. Every rota record hosted in the same
 * Adults section shares one roster, so the choice is stored once per host
 * section rather than once per record — a leader isn't re-prompted for
 * every planning section's record in the season bucket.
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
 * Storage key for the confirmed identity on one host section's roster.
 *
 * @param {string|number} hostSectionId - Host (Adults) section id
 * @returns {string} localStorage key
 */
function identityStorageKey(hostSectionId) {
  return `viking_rota_identity_${hostSectionId}`;
}

/**
 * Resolve the current user's member row in the rota host section.
 *
 * @param {import('../services/rotaService.js').RotaGroup|null} rotaGroup - Loaded rota group (null while loading)
 * @returns {{identity: {scoutid: string, name: string}|null, needsPicker: boolean, resolving: boolean, choose: Function, clear: Function}} Identity state
 */
export function useRotaIdentity(rotaGroup) {
  const [state, setState] = useState({ identity: null, needsPicker: false, resolving: true });

  const members = useMemo(() => rotaGroup?.members ?? [], [rotaGroup]);
  const hostSectionId = rotaGroup?.hostSection?.sectionid;

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!hostSectionId || members.length === 0) {
        setState({ identity: null, needsPicker: false, resolving: !hostSectionId });
        return;
      }

      const storedId = localStorage.getItem(identityStorageKey(hostSectionId));
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
          localStorage.setItem(identityStorageKey(hostSectionId), matches[0].scoutid);
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
  }, [hostSectionId, members]);

  const choose = useCallback(
    (scoutid) => {
      const member = members.find((entry) => entry.scoutid === String(scoutid));
      if (!member || !hostSectionId) {
        return;
      }
      localStorage.setItem(identityStorageKey(hostSectionId), member.scoutid);
      setState({ identity: member, needsPicker: false, resolving: false });
    },
    [members, hostSectionId],
  );

  const clear = useCallback(() => {
    if (hostSectionId) {
      localStorage.removeItem(identityStorageKey(hostSectionId));
    }
    setState({ identity: null, needsPicker: true, resolving: false });
  }, [hostSectionId]);

  return { ...state, choose, clear };
}
