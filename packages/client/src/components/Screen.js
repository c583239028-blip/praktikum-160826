import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { Colors, Spacing } from '@/constants/design';

/**
 * Shared screen wrapper — solves safe-area + background + base horizontal padding
 * in ONE place for every screen. See docs/responsive-ui-guidelines.md.
 *
 * Usage:
 *   <Screen>...</Screen>                        // light bg, top+bottom safe area, side padding
 *   <Screen padded={false}>...</Screen>          // full-bleed (lists)
 *   <Screen backgroundColor={Colors.surface...}> // override bg
 *
 * Note: video/camera surfaces (the live broadcast) are intentionally full-bleed dark and
 * should NOT use this wrapper — see [[dark-theme-temporary]] in project memory.
 */
export default function Screen({
  children,
  style,
  edges = ['top', 'bottom'],
  backgroundColor = Colors.surface.white,
  padded = true,
}) {
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor }, padded && styles.padded, style]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: Spacing.xl }, // 16
});

Screen.propTypes = {
  children: PropTypes.node,
  style: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.array,
    PropTypes.number,
  ]),
  edges: PropTypes.arrayOf(PropTypes.oneOf(['top', 'bottom', 'left', 'right'])),
  backgroundColor: PropTypes.string,
  padded: PropTypes.bool,
};
