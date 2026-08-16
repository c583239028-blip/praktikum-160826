import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { ProgressDots } from './ProgressDots';
import { Colors, Spacing, FontSize, Gradients } from '@/constants/design';

// Shared frame for every create-game wizard step: progress dots + title +
// optional back + the step's own body. Light theme by default; step 0 (Select
// Game Type) uses the gradient variant. The per-step forward/back buttons live
// in each step's body (Figma bottom nav); `onBack` here is an optional header
// affordance.

export function WizardShell({
  title,
  total,
  current,
  onBack,
  gradient = false,
  children,
}) {
  const { t } = useTranslation('host');
  const body = (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <ProgressDots total={total} current={current} onDark={gradient} />
      </View>

      {onBack ? (
        <TouchableOpacity
          style={styles.back}
          onPress={onBack}
          accessibilityLabel={t('back', 'חזרה')}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={Colors.text.secondary}
          />
        </TouchableOpacity>
      ) : null}

      <Text style={styles.title}>{title}</Text>

      <View style={styles.bodyPane}>{children}</View>
    </SafeAreaView>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={Gradients.brand}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.flex}
      >
        {body}
      </LinearGradient>
    );
  }
  return <View style={[styles.flex, styles.whiteBg]}>{body}</View>;
}

WizardShell.propTypes = {
  title: PropTypes.string.isRequired,
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
  onBack: PropTypes.func,
  gradient: PropTypes.bool,
  children: PropTypes.node.isRequired,
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  whiteBg: { backgroundColor: Colors.surface.white },
  header: { paddingTop: Spacing['2xl'], paddingBottom: Spacing.xl },
  back: {
    position: 'absolute',
    top: Spacing['3xl'],
    right: Spacing.lg,
    padding: Spacing.sm,
    zIndex: 1,
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSize.h2,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
  bodyPane: { flex: 1 },
});
