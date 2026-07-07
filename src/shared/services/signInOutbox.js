/**
 * Sign-in/out outbox: makes gate-time sign-in survive camp WiFi.
 *
 * Each sign-in/out is one operation carrying its field updates
 * (SignedInBy/When, SignedOutBy/When). The op is queued here and applied to
 * the local flexi cache (optimistic — the row renders signed-in at once).
 * Draining pushes each field update to OSM via the rate-limit queue,
 * persisting per-field progress so a failure mid-op resumes where it left
 * off instead of half-writing twice. Ops survive app restarts; they are
 * retried when the network returns (listener installed on enqueue and by
 * useSignInOut on mount).
 *
 * All store mutations are serialized through a lock and re-read the store
 * before writing, so an enqueue landing during an in-flight drain's network
 * await can never be clobbered by the drain's next persist.
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

// Serializes every read-modify-write on the outbox store. Both enqueue()
// and the drain's persists interleave at awaits; without this a concurrent
// enqueue is lost when the other writer persists its stale view.
let storeLock = Promise.resolve();
function withStoreLock(fn) {
  const run = storeLock.then(fn);
  storeLock = run.then(() => undefined, () => undefined);
  return run;
}

// Throws on store failure: callers must NOT treat an unreadable outbox as
// empty — enqueue would clobber every queued op with a one-element array.
async function readOps() {
  const stored = await IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, OUTBOX_KEY);
  return Array.isArray(stored?.ops) ? stored.ops : [];
}

async function writeOps(ops) {
  await IndexedDBService.set(IndexedDBService.STORES.CACHE_DATA, OUTBOX_KEY, { ops });
}

async function persistOp(op) {
  await withStoreLock(async () => {
    const stored = await readOps();
    const idx = stored.findIndex(o => o.id === op.id);
    if (idx >= 0) {
      stored[idx] = op;
      await writeOps(stored);
    }
  });
}

async function removeOp(id) {
  await withStoreLock(async () => {
    const stored = await readOps();
    await writeOps(stored.filter(o => o.id !== id));
  });
}

/**
 * A 4xx other than 401/429 (bad column id, permission denied, deleted
 * record) will fail identically on every retry. Retrying it forever would
 * head-of-line-block every later sign-in behind it.
 * @param {Error} error - Failure from updateFlexiRecord
 * @returns {boolean} True when retrying can never succeed
 */
function isPermanentWriteError(error) {
  const status = error?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 401 && status !== 429;
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
 * Adds an operation to the outbox. Throws when the store cannot be read or
 * written — callers must surface that instead of assuming the op is queued.
 * @param {Object} op - { id, memberLabel, action, scoutid, sectionid, extraid,
 *   termId, sectionType, updates: [{fieldId, value}], createdAt }
 * @returns {Promise<void>}
 */
export async function enqueue(op) {
  await withStoreLock(async () => {
    const stored = await readOps();
    stored.push(op);
    await writeOps(stored);
  });
  installNetworkListener();
}

/**
 * Number of operations waiting to sync. Tolerant of store failures (display
 * only — returns 0 rather than throwing).
 * @returns {Promise<number>}
 */
export async function pendingCount() {
  try {
    return (await readOps()).length;
  } catch (error) {
    logger.error('Failed to read sign-in outbox', { error: error.message }, LOG_CATEGORIES.ERROR);
    return 0;
  }
}

/**
 * Pushes pending operations to OSM in FIFO order. Per-field progress is
 * persisted, so an op interrupted after 2 of 4 writes resumes at field 3.
 * Transient failures (network, 401, 429) stop the drain and leave the
 * remainder queued; permanent failures (other 4xx) drop the op and continue,
 * reporting it in `errors` — retrying those forever would block every later
 * sign-in behind them.
 *
 * @param {string} [token] - OSM token; defaults to the current stored token
 * @returns {Promise<{completed: number, remaining: number, dropped: number, errors: Array<string>}>}
 */
export async function drain(token = getToken()) {
  if (draining) {
    return { completed: 0, remaining: await pendingCount(), dropped: 0, errors: [] };
  }

  draining = true;
  const errors = [];
  let completed = 0;
  let dropped = 0;

  try {
    if (!token) {
      return {
        completed,
        remaining: await pendingCount(),
        dropped,
        errors: ['No authentication token - sign in to OSM to sync'],
      };
    }

    for (;;) {
      // Fresh read each iteration: ops enqueued mid-drain are picked up,
      // never overwritten.
      const ops = await readOps();
      const op = ops[0];
      if (!op) break;

      let disposition = 'completed';

      while (op.updates.length > 0) {
        const update = op.updates[0];
        try {
          const result = await updateFlexiRecord(
            op.sectionid,
            op.scoutid,
            op.extraid,
            update.fieldId,
            update.value,
            op.termId,
            op.sectionType,
            token,
          );
          if (!result) {
            const err = new Error('updateFlexiRecord returned no result');
            err.status = 0;
            throw err;
          }
          op.updates.shift();
          await persistOp(op);
        } catch (error) {
          if (isPermanentWriteError(error)) {
            logger.error('Outbox operation dropped - permanent failure', {
              memberLabel: op.memberLabel,
              fieldId: update.fieldId,
              status: error.status,
              error: error.message,
            }, LOG_CATEGORIES.ERROR);
            errors.push(`${op.memberLabel}: ${error.message} (not retried)`);
            disposition = 'dropped';
          } else {
            logger.warn('Outbox drain stopped - will retry later', {
              memberLabel: op.memberLabel,
              fieldId: update.fieldId,
              error: error.message,
            }, LOG_CATEGORIES.API);
            errors.push(`${op.memberLabel}: ${error.message}`);
            disposition = 'halted';
          }
          break;
        }
      }

      if (disposition === 'halted') break;

      await removeOp(op.id);
      if (disposition === 'dropped') {
        dropped++;
      } else {
        completed++;
        logger.info('Outbox operation synced to OSM', {
          memberLabel: op.memberLabel,
          action: op.action,
        }, LOG_CATEGORIES.API);
      }
    }

    return { completed, remaining: await pendingCount(), dropped, errors };
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
