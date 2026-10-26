// What holding a finished card offers: a short action sheet, or straight to the only or first choice.
import * as Haptics from 'expo-haptics';
import { ActionSheetIOS, Platform } from 'react-native';

/** Holding a finished card: a short menu, or straight to the first choice off iOS. */
export function menu(options: { label: string; go: () => void }[]) {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  if (Platform.OS !== 'ios' || options.length === 1) return options[0].go();
  ActionSheetIOS.showActionSheetWithOptions({ options: [...options.map((o) => o.label), 'Cancel'], cancelButtonIndex: options.length }, (i) => options[i]?.go());
}
