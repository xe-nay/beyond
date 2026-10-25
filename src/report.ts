// The export: everything logged, laid out on A4 pages. One page model feeds the in-app preview, the
// PDF (as HTML for expo-print) and a plain-text copy, so the preview shows exactly what is exported.
import { exercise } from './catalog';
import { personalRecords, sessionMinutes, volumeLoad, working } from './domain/calc';
import { pace } from './domain/intervals';
import { MICROS } from './domain/micros';
import { sum } from './domain/nutrition';
import { formatWeight, toDisplay } from './domain/plates';
import { MEALS } from './meals';
import type { State } from './store';

export type Line =
  | { t: 'title'; text: string; sub?: string }
  | { t: 'h'; text: string; right?: string }
  | { t: 'meta'; text: string }
  | { t: 'cells'; cells: string[]; head?: boolean; dim?: boolean }
  | { t: 'gap' };
export interface Page { lines: Line[]; widths: Record<number, number[]> }

const HEIGHT: Record<Line['t'], number> = { title: 4, h: 2, meta: 1, cells: 1, gap: 0.6 };
const CAPACITY = 50; // lines on an A4 page at 10 pt
export const A4 = { w: 595, h: 842 };

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const n0 = (v: number) => Math.round(v).toLocaleString();

export function buildReport(s: State, from: string, to: string): Page[] {
  const unit = s.profile.unit;
  const w = (kg: number) => `${formatWeight(kg, unit)} ${unit}`;
  const inRange = (d: string) => d >= from && d <= to;
  const sessions = s.sessions.filter((x) => x.finishedAt && inRange(x.date)).sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!));
  const cardio = s.cardio.filter((c) => c.completed && inRange(c.date)).sort((a, b) => a.date.localeCompare(b.date));
  const foodDays = [...new Set([...s.entries.filter((e) => inRange(e.date)).map((e) => e.date), ...s.intakes.filter((i) => inRange(i.date)).map((i) => i.date)])].sort();
  const body = s.body.filter((b) => inRange(b.date) && (b.weightKg || b.waistCm)).sort((a, b) => a.date.localeCompare(b.date));

  // Blocks are kept together on a page when they fit; long ones continue on the next.
  const blocks: { lines: Line[]; widths: number[] }[] = [];
  // A section title waits for the section's first block, so it never ends a page alone.
  let heading: Line[] = [];
  const add = (lines: Line[], widths: number[] = []) => {
    blocks.push({ lines: [...heading, ...lines], widths });
    heading = [];
  };

  const volume = sessions.reduce((n, x) => n + volumeLoad(x.sets), 0);
  const minutes = sessions.reduce((n, x) => n + (sessionMinutes(x) ?? 0), 0);
  const kcalDays = foodDays.map((d) => sum([...s.entries.filter((e) => e.date === d).map((e) => e.nutrients), ...s.intakes.filter((i) => i.date === d && i.nutrients).map((i) => i.nutrients!)]));
  add([
    { t: 'title', text: 'Beyond · training and nutrition', sub: `${fmtDate(from)} to ${fmtDate(to)} · exported ${fmtDate(new Date().toISOString().slice(0, 10))}` },
    { t: 'h', text: 'Summary' },
    { t: 'cells', cells: ['Workouts', String(sessions.length), 'Working sets', String(sessions.reduce((n, x) => n + working(x.sets).length, 0))] },
    { t: 'cells', cells: ['Volume lifted', `${n0(toDisplay(volume, unit))} ${unit}`, 'Training time', `${Math.round(minutes / 60 * 10) / 10} h`] },
    { t: 'cells', cells: ['Cardio sessions', String(cardio.length), 'Cardio', `${cardio.reduce((n, c) => n + c.minutes, 0)} min · ${(cardio.reduce((n, c) => n + (c.distanceKm ?? 0), 0)).toFixed(1)} km`] },
    { t: 'cells', cells: ['Food days', String(foodDays.length), 'Average intake', kcalDays.length ? `${n0(kcalDays.reduce((n, k) => n + k.kcal, 0) / kcalDays.length)} kcal · ${n0(kcalDays.reduce((n, k) => n + k.protein, 0) / kcalDays.length)} g protein` : '—'] },
    { t: 'cells', cells: ['Targets', `${s.targets.kcal} kcal`, 'Protein · carbs · fat', `${s.targets.protein} · ${s.targets.carbs} · ${s.targets.fat} g`] },
  ], [22, 18, 24, 36]);

  if (sessions.length) heading = [{ t: 'gap' }, { t: 'title', text: 'Workouts' }];
  for (const x of sessions) {
    const prs = personalRecords(s.sessions, x);
    const lines: Line[] = [
      { t: 'h', text: `${fmtDate(x.date)} · ${x.name}`, right: [sessionMinutes(x) ? `${Math.round(sessionMinutes(x)!)} min` : null, x.sessionRpe ? `RPE ${x.sessionRpe}` : null, `${n0(toDisplay(volumeLoad(x.sets), unit))} ${unit}`].filter(Boolean).join(' · ') },
      { t: 'cells', head: true, cells: ['Exercise', 'Set', 'Weight', 'Reps', 'RIR', 'Rest'] },
    ];
    const count: Record<string, number> = {};
    for (const set of x.sets) {
      count[set.exerciseId] = (count[set.exerciseId] ?? 0) + (set.warmup ? 0 : 1);
      lines.push({
        t: 'cells', dim: set.warmup,
        cells: [exercise(set.exerciseId)?.name ?? set.exerciseId, set.warmup ? 'W' : String(count[set.exerciseId]), `${set.implements === 2 ? '2 × ' : ''}${w(set.loadKg)}`, String(set.reps), set.rir === null ? '—' : String(set.rir), set.restSeconds ? `${Math.round(set.restSeconds)} s` : '—'],
      });
    }
    if (prs.length) lines.push({ t: 'meta', text: `Records: ${prs.map((p) => exercise(p.exerciseId)?.name).join(', ')}` });
    if (x.notes) lines.push({ t: 'meta', text: x.notes });
    lines.push({ t: 'gap' });
    add(lines, [40, 8, 18, 10, 10, 14]);
  }

  if (cardio.length) {
    add([
      { t: 'gap' }, { t: 'title', text: 'Cardio' },
      { t: 'cells', head: true, cells: ['Date', 'Activity', 'Time', 'Distance', 'Pace', 'Effort', 'Heart rate'] },
      ...cardio.map((c): Line => ({ t: 'cells', cells: [fmtDate(c.date), c.activity, `${c.minutes} min`, c.distanceKm ? `${c.distanceKm.toFixed(2)} km` : '—', pace(c.minutes, c.distanceKm) ?? '—', c.rpe ? `${c.rpe}/10` : '—', c.avgHr ? `${c.avgHr} bpm` : '—'] })),
    ], [22, 14, 10, 13, 15, 10, 16]);
  }

  if (foodDays.length) heading = [{ t: 'gap' }, { t: 'title', text: 'Nutrition' }];
  for (const d of foodDays) {
    const entries = s.entries.filter((e) => e.date === d).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    const intakes = s.intakes.filter((i) => i.date === d);
    const total = sum([...entries.map((e) => e.nutrients), ...intakes.filter((i) => i.nutrients).map((i) => i.nutrients!)]);
    const lines: Line[] = [
      { t: 'h', text: fmtDate(d), right: `${n0(total.kcal)} kcal · P ${n0(total.protein)} · C ${n0(total.carbs)} · F ${n0(total.fat)} g` },
      { t: 'cells', head: true, cells: ['Time', 'Meal', 'Food', 'Amount', 'kcal', 'P / C / F'] },
      ...entries.map((e): Line => ({ t: 'cells', cells: [e.time ?? '—', MEALS.find((m) => m.value === e.meal)?.label ?? e.meal, e.name, `${Math.round(e.amount)} ${e.basis}`, String(e.nutrients.kcal), `${n0(e.nutrients.protein)} / ${n0(e.nutrients.carbs)} / ${n0(e.nutrients.fat)}`] })),
    ];
    if (intakes.length) lines.push({ t: 'meta', text: `Daily intake: ${intakes.map((i) => `${i.name} ${i.dose}`).join(' · ')}` });
    const micros = MICROS.filter((m) => (total.micro?.[m.key] ?? 0) > 0).map((m) => `${m.label} ${Math.round(total.micro![m.key] * 10) / 10} ${m.unit}${m.dv ? ` (${Math.round((total.micro![m.key] / m.dv) * 100)}%)` : ''}`);
    for (let i = 0; i < micros.length; i += 4) lines.push({ t: 'meta', text: micros.slice(i, i + 4).join(' · ') });
    if (total.fiber || total.sugar) lines.push({ t: 'meta', text: `Fibre ${Math.round((total.fiber ?? 0) * 10) / 10} g · sugars ${Math.round((total.sugar ?? 0) * 10) / 10} g · saturated fat ${Math.round((total.satFat ?? 0) * 10) / 10} g` });
    lines.push({ t: 'gap' });
    add(lines, [9, 13, 38, 12, 9, 19]);
  }

  if (body.length) {
    add([
      { t: 'gap' }, { t: 'title', text: 'Body' },
      { t: 'cells', head: true, cells: ['Date', 'Weight', 'Waist', 'Chest', 'Arm', 'Thigh'] },
      ...body.map((b): Line => ({ t: 'cells', cells: [fmtDate(b.date), b.weightKg ? w(b.weightKg) : '—', b.waistCm ? `${b.waistCm} cm` : '—', b.chestCm ? `${b.chestCm} cm` : '—', b.armCm ? `${b.armCm} cm` : '—', b.thighCm ? `${b.thighCm} cm` : '—'] })),
    ], [26, 16, 14, 14, 14, 16]);
  }

  // Pack blocks into pages. A table that spans pages repeats nothing fancy; it simply continues.
  const pages: Page[] = [];
  let page: Page = { lines: [], widths: {} };
  let used = 0;
  const flush = () => { if (page.lines.length) pages.push(page); page = { lines: [], widths: {} }; used = 0; };
  for (const b of blocks) {
    const h = b.lines.reduce((n, l) => n + HEIGHT[l.t], 0);
    if (used && used + h > CAPACITY && h <= CAPACITY) flush();
    for (const l of b.lines) {
      if (used + HEIGHT[l.t] > CAPACITY) flush();
      if (l.t === 'gap' && !page.lines.length) continue;
      if (l.t === 'cells') page.widths[page.lines.length] = b.widths;
      page.lines.push(l);
      used += HEIGHT[l.t];
    }
  }
  flush();
  return pages;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML for expo-print: one A4 sheet per page, with its number at the bottom. */
export function reportHtml(pages: Page[]) {
  const body = pages.map((p, i) => {
    const rows = p.lines.map((l, j) => {
      if (l.t === 'title') return `<div class="title">${esc(l.text)}</div>${l.sub ? `<div class="sub">${esc(l.sub)}</div>` : ''}`;
      if (l.t === 'h') return `<div class="h"><span>${esc(l.text)}</span><span class="r">${esc(l.right ?? '')}</span></div>`;
      if (l.t === 'meta') return `<div class="meta">${esc(l.text)}</div>`;
      if (l.t === 'gap') return '<div class="gap"></div>';
      const widths = p.widths[j] ?? [];
      return `<div class="row${l.head ? ' head' : ''}${l.dim ? ' dim' : ''}">${l.cells.map((c, k) => `<span style="width:${widths[k] ?? 100 / l.cells.length}%">${esc(c)}</span>`).join('')}</div>`;
    }).join('');
    return `<section class="page">${rows}<footer>Beyond · page ${i + 1} of ${pages.length}</footer></section>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #111827; font-size: 9.5pt; }
    .page { width: ${A4.w}pt; height: ${A4.h}pt; padding: 36pt 40pt 40pt; position: relative; page-break-after: always; overflow: hidden; }
    .title { font-size: 17pt; font-weight: 700; margin: 2pt 0 2pt; color: #0B1220; }
    .sub { font-size: 9pt; color: #6B7280; margin-bottom: 8pt; }
    .h { display: flex; justify-content: space-between; font-size: 11pt; font-weight: 650; margin: 8pt 0 4pt; padding-bottom: 3pt; border-bottom: 1.2pt solid #12B5C8; }
    .h .r { font-weight: 500; color: #4B5563; font-size: 9pt; }
    .row { display: flex; padding: 2.4pt 0; border-bottom: 0.5pt solid #E5E7EB; }
    .row span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding-right: 4pt; }
    .row.head { font-weight: 650; color: #6B7280; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.4pt; }
    .row.dim { color: #9CA3AF; }
    .meta { color: #4B5563; font-size: 8.5pt; padding: 2pt 0; }
    .gap { height: 6pt; }
    footer { position: absolute; bottom: 18pt; left: 40pt; right: 40pt; text-align: center; font-size: 8pt; color: #9CA3AF; }
  </style></head><body>${body}</body></html>`;
}

/** The same pages as plain text, for copying. */
export function reportText(pages: Page[]) {
  return pages.map((p) => p.lines.map((l) => {
    if (l.t === 'title') return `\n${l.text.toUpperCase()}${l.sub ? `\n${l.sub}` : ''}`;
    if (l.t === 'h') return `\n${l.text}${l.right ? `  (${l.right})` : ''}`;
    if (l.t === 'meta') return `  ${l.text}`;
    if (l.t === 'gap') return '';
    return (l.head ? '  ' : '  ') + l.cells.join(' | ');
  }).join('\n')).join('\n').trim();
}
