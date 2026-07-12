/**
 * Live online/offline status for the rota pages, so signup pills disable
 * and an offline banner shows instead of writes failing on tap.
 *
 * @module useOnlineStatus
 */

import { useEffect, useState } from 'react';
import { addNetworkListener, checkNetworkStatus } from '../../../shared/utils/networkUtils.js';

/**
 * Track network status.
 *
 * @returns {boolean} True when online (optimistically true until known)
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    checkNetworkStatus()
      .then((status) => {
        if (!cancelled) {
          setOnline(Boolean(status));
        }
      })
      .catch(() => {});

    const remove = addNetworkListener((status) => {
      if (!cancelled) {
        setOnline(Boolean(status?.connected ?? status));
      }
    });

    return () => {
      cancelled = true;
      if (typeof remove === 'function') {
        remove();
      }
    };
  }, []);

  return online;
}
