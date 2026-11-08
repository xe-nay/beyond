// Cable attachments for lat pulldowns and seated cable rows, as on the gym's rack: five black handles
// whose grips point forward (palms facing each other), from wide to close, and two chrome bars, a
// straight bar and the classic lat bar with angled ends. The choice is kept per set, so loads are
// compared only with sets done on the same attachment.
//
// What each grip changes for the muscles is in backFocus.ts (pulldowns: hardly anything; rows: narrow
// for the lats, wide for the traps and delts).
import type { Exercise } from './types';

export interface Attachment { id: string; name: string; full: string; group: 'parallel' | 'bar' }

export const ATTACHMENTS: Attachment[] = [
  { id: 'neutral-wide', name: 'Wide', full: 'Wide parallel grip · palms facing, well outside the shoulders', group: 'parallel' },
  { id: 'neutral-medium', name: 'Medium', full: 'Medium parallel grip · palms facing, just outside the shoulders', group: 'parallel' },
  { id: 'neutral-shoulder', name: 'Narrow', full: 'Narrow parallel grip · palms facing, shoulder width', group: 'parallel' },
  { id: 'neutral-close', name: 'Close', full: 'Close parallel grip · palms facing, inside the shoulders', group: 'parallel' },
  { id: 'v-handle', name: 'V-grip', full: 'V-grip · palms facing, hands almost together', group: 'parallel' },
  { id: 'straight-bar', name: 'Straight', full: 'Straight bar · overhand or underhand', group: 'bar' },
  { id: 'lat-bar', name: 'Lat bar', full: 'Lat bar with angled ends · overhand, wide', group: 'bar' },
];
export const attachment = (id: string | undefined) => ATTACHMENTS.find((a) => a.id === id);

const PULL = /pulldown|pull-down|seated cable row|cable row|elevated cable rows|kneeling cable row/i;
const NOT = /one[- ]arm|single[- ]arm|straight[- ]arm|rope|behind/i;

/** Lat pulldowns and seated cable rows done with a bar or handle (not one-arm or rope versions). */
export const takesAttachment = (e: Exercise | undefined) => !!e && (e.equipment === 'cable' || e.equipment === 'machine') && PULL.test(e.name) && !NOT.test(e.name);

/** The attachment an exercise's name implies, else the usual one for it. */
export function defaultAttachment(e: Exercise | undefined) {
  if (!e) return undefined;
  const n = e.name.toLowerCase();
  if (/v-bar|v bar|close/.test(n)) return 'v-handle';
  if (/reverse|underhand/.test(n)) return 'straight-bar';
  if (/wide/.test(n)) return /row/.test(n) ? 'neutral-wide' : 'lat-bar';
  return /row/.test(n) ? 'v-handle' : 'neutral-medium';
}

/** Reads an attachment from an import: its id or its name, in any case. */
export function parseAttachment(v: unknown) {
  if (typeof v !== 'string') return undefined;
  const k = v.trim().toLowerCase();
  return ATTACHMENTS.find((a) => a.id === k || a.name.toLowerCase() === k || a.full.toLowerCase().startsWith(k))?.id;
}
