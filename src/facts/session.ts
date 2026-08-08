import { distanceM } from '../geo';
import type { Coords } from '../types';

/**
 * The anti-doomscroll constraints live here:
 * - a session shows at most SESSION_CAP facts,
 * - moving UNLOCK_DISTANCE_M refreshes the session,
 * - seen facts are remembered for a week so revisits stay fresh.
 */

export const SESSION_CAP = 5;
export const UNLOCK_DISTANCE_M = 150;
const SEEN_KEY = 'mtm:seen';
const SEEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface SeenMap {
  [factId: string]: number; // last-seen timestamp
}

function loadSeen(): SeenMap {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as SeenMap;
    const cutoff = Date.now() - SEEN_MAX_AGE_MS;
    for (const [id, ts] of Object.entries(map)) {
      if (ts < cutoff) delete map[id];
    }
    return map;
  } catch {
    return {};
  }
}

function saveSeen(map: SeenMap): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    // Best-effort; forgetting seen facts is harmless.
  }
}

export class Session {
  private shownThisSession = 0;
  private sessionOrigin: Coords | null = null;
  private seen: SeenMap = loadSeen();

  get seenIds(): ReadonlySet<string> {
    return new Set(Object.keys(this.seen));
  }

  get factsLeft(): number {
    return Math.max(0, SESSION_CAP - this.shownThisSession);
  }

  get capReached(): boolean {
    return this.shownThisSession >= SESSION_CAP;
  }

  /** Record that a fact was shown at this position. */
  markShown(factId: string, at: Coords): void {
    this.shownThisSession += 1;
    this.sessionOrigin ??= at;
    this.seen[factId] = Date.now();
    saveSeen(this.seen);
  }

  /**
   * Called on position updates. If the user walked far enough from where
   * this session started, the cap resets — movement is the unlock.
   */
  maybeUnlock(current: Coords): boolean {
    if (!this.sessionOrigin) return false;
    if (distanceM(this.sessionOrigin, current) >= UNLOCK_DISTANCE_M) {
      this.shownThisSession = 0;
      this.sessionOrigin = current;
      return true;
    }
    return false;
  }
}
