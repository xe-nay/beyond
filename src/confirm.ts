import { Alert, Platform } from 'react-native';

/** Asks before something that removes; on the web preview, the browser's own dialog. */
export function confirmRemove(title: string, message: string, action: string, go: () => void) {
  if (Platform.OS === 'web') return window.confirm(`${title}\n${message}`) ? go() : undefined;
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: go }]);
}
