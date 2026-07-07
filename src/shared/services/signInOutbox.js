/**
 * Sign-in/out outbox: makes gate-time sign-in survive camp WiFi.
 *
 * Each sign-in/out is one operation carrying its field updates
 * (SignedInBy/When, SignedOutBy/When). The op is applied to the local flexi
 * cache immediately (optimistic — the row renders signed-in at once) and
 * queued here. Draining pushes each field update to OSM via the rate-limit
 * queue, persisting per-field progress so a failure mid-op resumes where it
 * left off instead of half-writing twice. Ops survive app restarts and are
 * retried when the network returns.
 *
 * @module signInOutbox
 */

import { updateFlexiRecord } from './api/api/flexiRecords.js';
import databaseService from './storage/database.js';
import { IndexedDBService } from './storage/indexedDBService.js';
import { addNetworkListener } from '../utils/networkUtils.js';
import { getToken } from './auth/tokenService.js';
import logger, { LOG_CATEGORIES } from './utils/logger.js';

const OUTBOX_KEY = 'viking_signin_outbox';

let draining = false;
let networkListenerInstalled = false;

async function readOps() {
  try {
    const stored = await IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, OUTBOX_KEY);
    return Array.isArray(stored?.ops) ? stored.ops : [];
  } catch (error) {
    logger.error('Failed to read sign-in outbox', { error: error.message }, LOG_CATEGORIES.ERROR);
    return [];
  }
}

async function writeOps(ops) {
  await IndexedDBService.set(IndexedDBService.STORES.CACHE_DATA, OUTBOX_KEY, { ops });
}

/**
 * Applies an operation's field updates to the locally cached flexi data so
 * the UI reflects the change instantly, before (or without) network.
 * @param {Object} op - Outbox operation
 * @returns {Promise<void>}
 */
export async function applyLocal(op) {
  try {
    const cached = await databaseService.getFlexiData(op.extraid, op.sectionid, op.termId);
    const items = Array.isArray(cached?.items) ? [...cached.items] : [];
    const idx = items.findIndex(item => String(item.scoutid) === String(op.scoutid));

    const patch = {};
    for (const update of op.updates) {
      patch[update.fieldId] = update.value;
    }

    if (idx >= 0) {
      items[idx] = { ...items[idx], ...patch };
    } else {
      items.push({ scoutid: op.scoutid, ...patch });
    }

    await databaseService.saveFlexiData(op.extraid, op.sectionid, op.termId, items);
  } catch (error) {
    logger.error('Failed to apply optimistic sign-in update to local cache', {
      error: error.message,
      scoutid: op.scoutid,
    }, LOG_CATEGORIES.ERROR);
  }
}

/**
 * Adds an operation to the outbox (after applying it locally).
 * @param {Object} op - { id, memberLabel, action, scoutid, sectionid, extraid,
 *   termId, sectionType, updates: [{fieldId, value}], createdAt }
 * @returns {Promise<void>}
 */
export async function enqueue(op) {
  const ops = await readOps();
  ops.push(op);
  await writeOps(ops);
  installNetworkListener();
}

/**
 * Number of operations waiting to sync.
 * @returns {Promise<number>}
 */
export async function pendingCount() {
  return (await readOps()).length;
}

/**
 * Pushes pending operations to OSM in FIFO order. Per-field progress is
 * persisted, so an op interrupted after 2 of 4 writes resumes at field 3.
 * Stops early when a push fails (assumed connectivity/auth) and leaves the
 * remainder queued for the next drain.
 *
 * @param {string} [token] - OSM token; defaults to the current stored token
 * @returns {Promise<{completed: number, remaining: number, errors: Array<string>}>}
 */
export async function drain(token = getToken()) {
  if (draining) {
    return { completed: 0, remaining: await pendingCount(), errors: [] };
  }

  draining = true;
  const errors = [];
  let completed = 0;

  try {
    const ops = await readOps();

    while (ops.length > 0) {
      if (!token) {
        errors.push('No authentication token - sign in to OSM to sync');
        break;
      }

      const op = ops[0];
      let failed = false;

      while (op.updates.length > 0) {
        const update = op.updates[0];
        try {
          await updateFlexiRecord(
            op.sectionid,
            op.scoutid,
            op.extraid,
            update.fieldId,
            update.value,
            op.termId,
            op.sectionType,
            token,
          );
          op.updates.shift();
          await writeOps(ops);
        } catch (error) {
          logger.warn('Outbox drain stopped - will retry later', {
            memberLabel: op.memberLabel,
            fieldId: update.fieldId,
            error: error.message,
            remainingOps: ops.length,
          }, LOG_CATEGORIES.API);
          errors.push(`${op.memberLabel}: ${error.message}`);
          failed = true;
          break;
        }
      }

      if (failed) break;

      ops.shift();
      await writeOps(ops);
      completed++;
      logger.info('Outbox operation synced to OSM', {
        memberLabel: op.memberLabel,
        action: op.action,
      }, LOG_CATEGORIES.API);
    }

    return { completed, remaining: ops.length, errors };
  } finally {
    draining = false;
  }
}

/**
 * Installs a one-time network listener that drains the outbox whenever
 * connectivity returns.
 */
export function installNetworkListener() {
  if (networkListenerInstalled) return;
  networkListenerInstalled = true;

  try {
    addNetworkListener((status) => {
      if (status.connected) {
        drain().then(({ completed, remaining }) => {
          if (completed > 0) {
            logger.info('Outbox drained after network restore', {
              completed,
              remaining,
            }, LOG_CATEGORIES.API);
          }
        }).catch((error) => {
          logger.error('Outbox drain after network restore failed', {
            error: error.message,
          }, LOG_CATEGORIES.ERROR);
        });
      }
    });
  } catch (error) {
    networkListenerInstalled = false;
    logger.warn('Could not install outbox network listener', {
      error: error.message,
    }, LOG_CATEGORIES.API);
  }
}

export default { enqueue, drain, applyLocal, pendingCount, installNetworkListener };
