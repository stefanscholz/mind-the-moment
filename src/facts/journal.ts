import type { Fact } from '../types';

/**
 * The journal keeps every fact the user has actually seen, so they can
 * look at them again — the radar screen is drawn from this. Mission-aligned
 * retention: a record of places learned about, not a feed.
 */

const KEY = 'mtm:journal';
const MAX_ENTRIES = 100;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface JournalEntry {
  fact: Fact;
  seenAt: number;
}

export function journalEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as JournalEntry[];
    const cutoff = Date.now() - MAX_AGE_MS;
    return entries.filter((e) => e.seenAt >= cutoff && e.fact?.id);
  } catch {
    return [];
  }
}

export function journalAdd(fact: Fact): void {
  try {
    const entries = journalEntries().filter((e) => e.fact.id !== fact.id);
    entries.push({ fact, seenAt: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Best-effort; the journal is a convenience, not core state.
  }
}
