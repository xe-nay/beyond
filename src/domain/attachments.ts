// Cable attachments for lat pulldowns and seated cable rows, as on the gym's rack: five black handles
// whose grips point forward (palms facing each other), from wide to close, and two chrome bars, a
// straight bar and the classic lat bar with angled ends. The choice is kept per set, so loads are
// compared only with sets done on the same attachment.
//
// What the grips change (EMG studies; differences are small): grip width hardly changes lat activity in
// the pulldown, with a slight edge for a medium grip (Andersen et al. 2014); an overhand grip works the
// lats a little more than an underhand one (Lusk et al. 2010). A parallel grip usually lets more
// weight be moved and is easier on the shoulders.
import type { Exercise, Region } from './types';

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

/**
 * What a grip changes, in words, and the muscles it brings in more. Studies find the differences
 * small: width barely moves lat activity (Andersen et al. 2014), overhand a little more than
 * underhand (Lusk et al. 2010); a closer grip lengthens the pull with the elbows by the sides.
 */
export function attachmentFocus(id: string | undefined): { more: Region[]; note: string } | null {
  if (id === 'neutral-wide' || id === 'lat-bar') return { more: [], note: 'Wide: a shorter pull led by the lats and upper back. Width changes lat work only a little in studies.' };
  if (id === 'neutral-medium') return { more: [], note: 'Medium: in studies a slight edge for the lats; the parallel grip usually lets you pull more weight.' };
  if (id === 'neutral-shoulder' || id === 'neutral-close' || id === 'v-handle') return { more: ['trapezius', 'biceps'], note: 'Close: a longer pull with the elbows by your sides, so the mid back and biceps share more of the work.' };
  if (id === 'straight-bar') return { more: [], note: 'Overhand works the lats a little more than underhand in studies; underhand lets the biceps help more.' };
  return null;
}
