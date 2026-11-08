// Which parts of the back a pulling exercise works, from EMG studies (surface EMG, small samples of
// trained men; differences between variants are modest, and EMG is not growth):
// - Lat pulldown grips barely matter: 7 grips (wide/narrow, overhand/underhand/neutral) showed no
//   difference in lats, middle and lower traps, biceps or infraspinatus; only the rear delts rose when
//   leaning back 30° (2025, 40 trained men, PMC12452428). Width changed nothing but the weight lifted
//   (less with a wide grip: Andersen et al. 2014). Overhand works the lats a little more than underhand
//   (Lusk et al. 2010). Behind the neck is the weakest for the lats (Sperandei et al. 2009).
// - Pull-ups bring in the lower traps more, chin-ups the biceps and chest (Youdas et al. 2010).
// - Rows: a narrow grip favours the lats; a wide grip the whole trapezius (upper, middle, lower) and the
//   side delts (Padovan et al. 2025, high-density EMG). Elbows out raises the traps and rear delts,
//   elbows in the lats (seated cable row, grip and shoulder-abduction study, 2023). The seated row
//   works the middle traps and rhomboids most of the lat exercises (Lehman et al. 2004).
// - The inverted row works the lats and upper back most with the least spine load; the bent-over row
//   loads the lower back most (Fenwick et al. 2009).
// - The straight-arm pulldown works the lats and the triceps' long head, hardly the biceps (2022).
// Teres major has no comparisons of its own; it works with the lats on every pull (anatomy).
import type { Exercise } from './types';

export type BackPart = 'lats' | 'teres' | 'midTraps' | 'lowerTraps' | 'upperTraps' | 'rearDelts' | 'biceps' | 'lowerBack';

export const BACK_PART_NAMES: Record<BackPart, string> = {
  lats: 'Lats', teres: 'Teres major', midTraps: 'Mid traps · rhomboids', lowerTraps: 'Lower traps',
  upperTraps: 'Upper traps', rearDelts: 'Rear delts', biceps: 'Biceps', lowerBack: 'Lower back',
};

/** 3 leads, 2 works hard, 1 helps. */
export type Level = 1 | 2 | 3;
export interface BackFocus { parts: [BackPart, Level][]; note: string; source: string }

const WIDE = new Set(['neutral-wide', 'lat-bar']);
const CLOSE = new Set(['neutral-shoulder', 'neutral-close', 'v-handle']);

export function backFocus(e: Exercise | undefined, attachment?: string): BackFocus | null {
  if (!e || e.category !== 'strength') return null;
  const n = e.name.toLowerCase();

  if (/straight[- ]arm/.test(n) && /pulldown|pull-down/.test(n)) {
    return { parts: [['lats', 3], ['teres', 2], ['lowerTraps', 1], ['rearDelts', 1]], note: 'Arms straight: the lats pull the arms down on their own, with the triceps’ long head; the biceps hardly work.', source: 'Straight-arm pulldown vs pullover EMG, 2022' };
  }
  if (/chin[- ]?up|underhand|reverse[- ]grip/.test(n) && /pull|chin/.test(n)) {
    return { parts: [['lats', 3], ['biceps', 3], ['teres', 2], ['lowerTraps', 1], ['midTraps', 1]], note: 'Palms facing you: the lats lead and the biceps work harder; overhand works the lats a little more.', source: 'Youdas et al. 2010; Lusk et al. 2010' };
  }
  if (/pull[- ]?up|pullup|muscle[- ]up/.test(n)) {
    return { parts: [['lats', 3], ['teres', 2], ['lowerTraps', 2], ['biceps', 2], ['midTraps', 1], ['rearDelts', 1]], note: 'Overhand: the lats lead, with more lower traps than a chin-up.', source: 'Youdas et al. 2010' };
  }
  if (/pulldown|pull-down/.test(n)) {
    if (/behind/.test(n)) {
      return { parts: [['lats', 2], ['rearDelts', 2], ['teres', 2], ['midTraps', 1], ['biceps', 1]], note: 'Behind the neck works the lats least of the pulldowns and strains the shoulder: in front is the better choice.', source: 'Sperandei et al. 2009' };
    }
    const grip = attachment === 'straight-bar' ? ' Overhand on the straight bar works the lats a little more than underhand.' : WIDE.has(attachment ?? '') ? ' A wide grip only lowers the weight you can pull.' : '';
    return {
      parts: [['lats', 3], ['teres', 2], ['lowerTraps', 2], ['biceps', 2], ['midTraps', 1], ['rearDelts', 1]],
      note: `The lats lead with every grip: in studies width and hand position barely change which muscles work.${grip} Leaning back about 30° brings in the rear delts.`,
      source: '2025 study of 7 grips (40 trained men); Andersen et al. 2014; Lusk et al. 2010',
    };
  }
  if (/inverted row|ring row|trx row|body row/.test(n)) {
    return { parts: [['lats', 3], ['midTraps', 3], ['rearDelts', 2], ['teres', 2], ['lowerTraps', 2], ['biceps', 2]], note: 'Works the lats and upper back hard while loading the spine the least of the rows.', source: 'Fenwick et al. 2009' };
  }
  // Rows (whole word: not "narrow" or "throw"); upright rows are a shoulder exercise.
  if (/\brows?\b/.test(n) && !/upright/.test(n)) {
    const bent = /bent[- ]over|barbell row|pendlay|t-bar|yates/.test(n) && !/chest|incline|supported/.test(n);
    // The attachment chosen decides the grip; without one, the exercise's name does.
    const wide = attachment ? WIDE.has(attachment) : /wide|rear[- ]delt|to neck|face pull/.test(n);
    const close = attachment ? CLOSE.has(attachment) : !wide && /close|v-bar|neutral|one[- ]arm|single[- ]arm|dumbbell/.test(n);
    const parts: [BackPart, Level][] = wide
      ? [['midTraps', 3], ['rearDelts', 3], ['upperTraps', 2], ['lowerTraps', 2], ['lats', 2], ['biceps', 2]]
      : close
        ? [['lats', 3], ['midTraps', 2], ['teres', 2], ['rearDelts', 2], ['biceps', 2], ['lowerTraps', 1]]
        : [['lats', 3], ['midTraps', 3], ['rearDelts', 2], ['teres', 2], ['lowerTraps', 1], ['biceps', 2]];
    if (bent) parts.push(['lowerBack', 3]);
    const note = wide
      ? 'Wide grip, elbows out: the traps (upper, middle and lower) and rear delts take over from the lats.'
      : close
        ? 'Close grip, elbows by your sides: the lats lead, the mid back helps.'
        : 'Middle grip: lats and mid back share the pull; elbows out for more traps and rear delts, in for more lats.';
    return { parts, note: bent ? `${note} Bent over, the lower back holds the position and takes the most load of the rows.` : note, source: bent ? 'Padovan et al. 2025; Fenwick et al. 2009' : 'Padovan et al. 2025; seated row grip study 2023; Lehman et al. 2004' };
  }
  return null;
}
