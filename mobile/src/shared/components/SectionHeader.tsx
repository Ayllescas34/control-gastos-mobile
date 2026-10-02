import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '../icons';
import { layout, spacing } from '../theme';
import { AppText } from './AppText';

type SectionAction = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  accessibilityHint?: string;
  testID?: string;
};

type SectionHeaderProps = {
  title: string;
  action?: SectionAction;
};

/** Title of a screen section with an optional inline action (e.g. "Agregar cuenta"). */
export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={styles.header}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {action && (
        <Pressable
          testID={action.testID}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityHint={action.accessibilityHint}
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          {action.icon && <Icon name={action.icon} size="sm" color="primary" />}
          <AppText variant="label" color="primary">
            {action.label}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
