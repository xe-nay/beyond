// The detailed body (Open-Muscle-Map artwork, MIT: src/data/muscle-map): every panel drawn dark, then
// the parts an exercise works on top in three shades of one colour, brightest where it leads
// (domain/anatomy.ts). The upper chest and the mid traps have no panel of their own, so the chest
// and the mid-lower trapezius are cut in two along their height.
//
// Each shade is its own layer, so the layers can light up in order (what leads first) and the part
// picked in the legend can pulse, with opacity alone.
import { useEffect, useId, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import female from '../data/muscle-map/female.json';
import male from '../data/muscle-map/male.json';
import type { Level } from '../domain/backFocus';
import type { Part } from '../domain/anatomy';
import { colors } from '../theme';

type Shape = { v: 'f' | 'r'; t: string; p: [string, string][]; m?: string; s?: string; side?: string; b?: number[] };
type Box = [number, number, number, number]; // x, y, width, height
interface Piece { key: string; view: 'f' | 'r'; t: string; p: [string, string][]; part: Part | null; muscle: boolean; clip?: Box; b?: number[] }

/** Shades by level: helps, works hard, leads. */
export const SHADES: Record<Level, string> = { 1: '#1D5A6B', 2: '#2AA3B6', 3: colors.cyan };
const PANEL = '#232B3A';
const SKIN = '#151B27';

const PANEL_PART: Record<string, Part> = {
  anterior_deltoid: 'frontDelts', lateral_deltoid: 'sideDelts', posterior_deltoid: 'rearDelts',
  latissimus_dorsi: 'lats', posterior_rotator_cuff: 'teres', erector_spinae: 'lowerBack',
  biceps_brachii: 'biceps', brachialis: 'brachialis', forearm_flexors: 'forearmFlexors', forearm_extensors: 'forearmExtensors',
  triceps_brachii: 'triceps', rectus_abdominis: 'abs', external_oblique: 'obliques', serratus_anterior: 'serratus',
  gluteus_maximus: 'glutes', gluteus_medius: 'gluteMed', tensor_fasciae_latae: 'gluteMed',
  rectus_femoris: 'rectusFemoris', vastus_lateralis: 'quads', vastus_medialis: 'quads',
  biceps_femoris: 'hamstrings', medial_hamstrings: 'hamstrings', hip_adductors: 'adductors', iliopsoas: 'hipFlexors', sartorius: 'hipFlexors',
  gastrocnemius: 'calves', soleus: 'soleus', tibialis_anterior: 'tibialis', fibularis_group: 'tibialis', sternocleidomastoid: 'neck',
};

/** Panels cut in two: the share of the height that goes to the first part. */
const SPLIT: Record<string, [Part, Part, number]> = {
  pectoralis_major: ['upperChest', 'lowerChest', 0.36],
  'trapezius/middle_lower': ['midTraps', 'lowerTraps', 0.5],
};

function pieces(shapes: Shape[]): Piece[] {
  const out: Piece[] = [];
  shapes.forEach((s, i) => {
    const base = { view: s.v, t: s.t, p: s.p, b: s.b, muscle: !!s.m };
    const split = s.m && (SPLIT[`${s.m}/${s.s}`] ?? SPLIT[s.m]);
    if (split && s.b) {
      const [x0, y0, x1, y1] = s.b;
      const cut = y0 + (y1 - y0) * split[2];
      out.push({ ...base, key: `${i}a`, part: split[0], clip: [x0 - 4, y0 - 4, x1 - x0 + 8, cut - y0 + 4] });
      out.push({ ...base, key: `${i}b`, part: split[1], clip: [x0 - 4, cut, x1 - x0 + 8, y1 - cut + 4] });
      return;
    }
    const part = s.m === 'trapezius' ? 'upperTraps' : s.m ? PANEL_PART[s.m] ?? null : null;
    out.push({ ...base, key: String(i), part });
  });
  return out;
}

const MAPS = { male: pieces((male as unknown as { shapes: Shape[] }).shapes), female: pieces((female as unknown as { shapes: Shape[] }).shapes) };
const VIEWS: Record<'front' | 'rear' | 'both', Box> = { front: [0, 0, 627, 1254], rear: [627, 0, 627, 1254], both: [0, 0, 1254, 1254] };

/** The view (front or back) where the work is, cut down to the lit parts, for a small picture. */
export function focusBox(parts: [Part, Level][], sex: 'male' | 'female' = 'male', aspect = 0.75, only?: 'front' | 'rear'): { view: 'front' | 'rear'; box: Box } {
  const level = new Map(parts);
  const lit = MAPS[sex].filter((p) => p.part && level.has(p.part) && p.b);
  const score = (v: 'f' | 'r') => lit.filter((p) => p.view === v).reduce((n, p) => n + (level.get(p.part!) ?? 0) ** 2, 0);
  const view = only ?? (score('r') > score('f') ? 'rear' : 'front');
  const mine = lit.filter((p) => p.view === (view === 'rear' ? 'r' : 'f'));
  const [vx, , vw] = VIEWS[view];
  if (!mine.length) return { view, box: VIEWS[view] };
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of mine) {
    const [a, b, c, d] = p.clip ? [p.clip[0], p.clip[1], p.clip[0] + p.clip[2], p.clip[1] + p.clip[3]] : p.b!;
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
  }
  // Pad, keep both sides of the body (the parts come in pairs), then widen to the picture's shape.
  const pad = 90;
  let h = Math.max(y1 - y0 + pad * 2, 380);
  let w = Math.max(x1 - x0 + pad * 2, 300);
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const cx = vx + vw / 2;
  const cy = Math.min(Math.max((y0 + y1) / 2, h / 2), 1254 - h / 2);
  return { view, box: [cx - w / 2, cy - h / 2, w, h] };
}

function Layer({ items, fill, box, width, height, id }: { items: Piece[]; fill: string | ((p: Piece) => string); box: Box; width: number; height: number; id: string }) {
  const clipped = items.filter((p) => p.clip);
  return (
    <Svg width={width} height={height} viewBox={box.join(' ')} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      {clipped.length > 0 && (
        <Defs>
          {clipped.map((p) => <ClipPath key={p.key} id={`${id}-${p.key}`}><Rect x={p.clip![0]} y={p.clip![1]} width={p.clip![2]} height={p.clip![3]} /></ClipPath>)}
        </Defs>
      )}
      {items.map((p) => (
        <G key={p.key} clipPath={p.clip ? `url(#${id}-${p.key})` : undefined}>
          <G transform={p.t}>{p.p.map(([d, t], i) => <Path key={i} d={d} transform={t || undefined} fill={typeof fill === 'string' ? fill : fill(p)} />)}</G>
        </G>
      ))}
    </Svg>
  );
}

/**
 * The body with the parts lit by level. `view` picks front, back or both side by side; `box` crops.
 * `reveal` changing lights the layers again in order; `selected` pulses one part in lime.
 */
export function AnatomyBody({ parts, sex = 'male', view = 'both', box, width, height, reveal, selected }: {
  parts: [Part, Level][]; sex?: 'male' | 'female'; view?: 'front' | 'rear' | 'both'; box?: Box; width: number; height?: number; reveal?: string | number; selected?: Part | null;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const reduced = useReducedMotion();
  const vb = box ?? VIEWS[view];
  const h = height ?? width * (vb[3] / vb[2]);
  const all = MAPS[sex];
  const [vx, , vw] = vb;
  const shown = useMemo(() => all.filter((p) => (vx < 627 ? vx + vw > 627 || p.view === 'f' : p.view === 'r')), [all, vx, vw]);
  const level = new Map(parts);
  const byLevel = ([1, 2, 3] as Level[]).map((l) => shown.filter((p) => p.part && level.get(p.part) === l));

  // Leads first, then works hard, then helps.
  const o3 = useSharedValue(1), o2 = useSharedValue(1), o1 = useSharedValue(1);
  useEffect(() => {
    if (reduced || reveal === undefined) return;
    [o3, o2, o1].forEach((o, i) => { o.set(0); o.set(withDelay(80 + i * 140, withTiming(1, { duration: 320 }))); });
  }, [reveal, reduced, o1, o2, o3]);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!selected || reduced) { pulse.set(1); return; }
    pulse.set(withRepeat(withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })), -1));
  }, [selected, reduced, pulse]);
  const s3 = useAnimatedStyle(() => ({ opacity: o3.get() }));
  const s2 = useAnimatedStyle(() => ({ opacity: o2.get() }));
  const s1 = useAnimatedStyle(() => ({ opacity: o1.get() }));
  const sp = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  const fill = [StyleSheetAbs, { width, height: h }];

  return (
    <View style={{ width, height: h }} pointerEvents="none">
      <Layer items={shown} fill={(p) => (p.muscle ? PANEL : SKIN)} box={vb} width={width} height={h} id={`${id}b`} />
      <Animated.View style={[fill, s1]}><Layer items={byLevel[0]} fill={SHADES[1]} box={vb} width={width} height={h} id={`${id}1`} /></Animated.View>
      <Animated.View style={[fill, s2]}><Layer items={byLevel[1]} fill={SHADES[2]} box={vb} width={width} height={h} id={`${id}2`} /></Animated.View>
      <Animated.View style={[fill, s3]}><Layer items={byLevel[2]} fill={SHADES[3]} box={vb} width={width} height={h} id={`${id}3`} /></Animated.View>
      {selected && <Animated.View style={[fill, sp]}><Layer items={shown.filter((p) => p.part === selected)} fill={colors.lime} box={vb} width={width} height={h} id={`${id}s`} /></Animated.View>}
    </View>
  );
}

const StyleSheetAbs = { position: 'absolute' as const, left: 0, top: 0 };
