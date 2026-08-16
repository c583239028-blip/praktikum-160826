import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/design';
import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export const EnteringScreen = ({ text }) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation('game');
  const displayText = text ?? t('going_live');

  useEffect(() => {
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 3600, // 10 full rotations before loop resets
        duration: 10000, // 10 seconds = 1 second per rotation
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 3600],
    outputRange: ['0deg', '3600deg'],
  });

  return (
    <View style={styles.container}>
      {/* Spinner */}
      <Animated.View
        style={[
          styles.spinner,
          {
            transform: [{ rotate: spin }],
          },
        ]}
      >
        <View style={styles.spinnerInner} />
      </Animated.View>

      {/* Heading Text */}
      <Text style={styles.heading}>{displayText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[900],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  spinner: {
    width: 24,
    height: 24,
    marginBottom: Spacing['2xl'],
  },
  spinnerInner: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderTopColor: Colors.surface.white,
    borderRightColor: Colors.surface.white,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRadius: 12,
  },
  heading: {
    fontSize: FontSize.bodyM,
    fontWeight: FontWeight.bold,
    color: Colors.surface.white,
    textAlign: 'center',
  },
});

EnteringScreen.propTypes = {
  text: PropTypes.string,
};
