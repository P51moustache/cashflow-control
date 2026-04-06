// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chart.line.uptrend.xyaxis': 'show-chart',
  'list.bullet.rectangle': 'list',
  'creditcard.fill': 'credit-card',
  'plus.circle.fill': 'add-circle',
  'trash.fill': 'delete',
  'gearshape.fill': 'settings',
  'arrow.up.circle.fill': 'arrow-upward',
  'arrow.down.circle.fill': 'arrow-downward',
  'minus.circle': 'remove-circle-outline',
  'flame': 'local-fire-department',
  'circle.circle': 'adjust',
  'xmark': 'close',
  'checkmark.circle.fill': 'check-circle',
  'star.fill': 'star',
  'dollarsign.circle': 'attach-money',
  'info.circle': 'info-outline',
  'sparkles': 'auto-awesome',
  'magnifyingglass': 'search',
  'xmark.circle.fill': 'cancel',
  'person.circle': 'account-circle',
  'rectangle.portrait.and.arrow.right': 'logout',
  'trash.circle': 'delete-forever',
  'crown.fill': 'workspace-premium',
  'arrow.clockwise': 'refresh',
  'arrow.triangle.2.circlepath': 'sync',
  'externaldrive.fill': 'storage',
  'square.and.arrow.up': 'ios-share',
  'square.and.arrow.down': 'download',
  'envelope.fill': 'email',
  'doc.text': 'description',
  'hand.raised.fill': 'privacy-tip',
  'checkmark.shield.fill': 'verified-user',
  'pencil': 'edit',
  'chevron.left': 'chevron-left',
  'arrow.up.right': 'open-in-new',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
