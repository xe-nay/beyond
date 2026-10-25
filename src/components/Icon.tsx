import { SymbolView, type SymbolViewProps, type SymbolWeight } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { colors } from '../theme';

export type IconName = Extract<SymbolViewProps['name'], string>;

// Material names used only by the browser preview; the iPhone renders SF Symbols.
const preview: Partial<Record<IconName, string>> = {
  'figure.strengthtraining.traditional': 'fitness_center',
  'dumbbell.fill': 'fitness_center',
  'figure.run': 'directions_run',
  'fork.knife': 'restaurant',
  'chart.xyaxis.line': 'show_chart',
  'chart.bar.fill': 'bar_chart',
  'person.crop.circle': 'account_circle',
  'sun.max.fill': 'wb_sunny',
  'barcode.viewfinder': 'barcode_scanner',
  barcode: 'barcode',
  magnifyingglass: 'search',
  plus: 'add',
  minus: 'remove',
  checkmark: 'check',
  'checkmark.circle.fill': 'check_circle',
  xmark: 'close',
  'xmark.circle.fill': 'cancel',
  'chevron.right': 'chevron_right',
  'chevron.left': 'chevron_left',
  'chevron.down': 'expand_more',
  'play.fill': 'play_arrow',
  'pause.fill': 'pause',
  'forward.fill': 'fast_forward',
  'stop.fill': 'stop',
  timer: 'timer',
  'arrow.triangle.2.circlepath': 'sync',
  'arrow.left.arrow.right': 'swap_horiz',
  'square.and.arrow.down': 'download',
  'square.and.arrow.up': 'ios_share',
  'doc.badge.plus': 'note_add',
  'star.fill': 'star',
  star: 'star_border',
  trash: 'delete',
  pencil: 'edit',
  'heart.fill': 'favorite',
  'flame.fill': 'local_fire_department',
  'bolt.fill': 'bolt',
  'trophy.fill': 'emoji_events',
  'scalemass.fill': 'monitor_weight',
  'ruler.fill': 'straighten',
  'camera.fill': 'photo_camera',
  'photo.fill': 'image',
  'bed.double.fill': 'bed',
  'speaker.wave.2.fill': 'volume_up',
  'speaker.slash.fill': 'volume_off',
  'bell.fill': 'notifications',
  'list.bullet': 'list',
  'calendar': 'calendar_today',
  'gearshape.fill': 'settings',
  'info.circle': 'info',
  'exclamationmark.triangle.fill': 'warning',
  'wand.and.stars': 'auto_awesome',
  'arrow.up.right': 'north_east',
  'arrow.down.right': 'south_east',
  'figure.walk': 'directions_walk',
  'bicycle': 'directions_bike',
  'figure.rower': 'rowing',
  'figure.pool.swim': 'pool',
  'figure.stair.stepper': 'stairs',
  'figure.elliptical': 'directions_run',
  'figure.highintensity.intervaltraining': 'sports_gymnastics',
  'flashlight.on.fill': 'flashlight_on',
  'keyboard': 'keyboard',
  'ellipsis': 'more_horiz',
  'gauge.with.dots.needle.67percent': 'speed',
  'arrow.counterclockwise': 'restart_alt',
  'location.fill': 'location_on',
  'waveform': 'graphic_eq',
  'square.on.square': 'content_copy',
  'doc.on.clipboard': 'content_paste',
};

type Props = { name: IconName; size?: number; color?: ColorValue; weight?: SymbolWeight; style?: StyleProp<ViewStyle> };

export function Icon({ name, size = 20, color = colors.text, weight = 'semibold', style }: Props) {
  const p = (preview[name] ?? 'circle') as never;
  return <SymbolView name={{ ios: name, android: p, web: p }} size={size} tintColor={color} weight={weight} style={[{ width: size, height: size }, style]} />;
}
