import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import {
  Colors,
  Spacing,
  FontSize,
  FontWeight,
} from '../../../constants/design';
import { useTranslation } from 'react-i18next';

function LiveTabIcon({ focused, label }) {
  return (
    <View style={styles.liveButton}>
      <View style={[styles.liveInner, focused && styles.liveInnerFocused]}>
        <Text style={styles.liveText}>{label}</Text>
      </View>
    </View>
  );
}

LiveTabIcon.propTypes = {
  focused: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
};

export default function TabsLayout() {
  const { t } = useTranslation('tabbar');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary.default,
        tabBarInactiveTintColor: Colors.text.secondary,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t('friends'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <LiveTabIcon focused={focused} label={t('live_badge')} />
          ),
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('messages'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.neutral[900],
    borderTopColor: Colors.neutral[600],
    borderTopWidth: 1,
    height: 60,
    paddingBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.caption,
  },
  liveButton: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
    shadowColor: Colors.primary.default,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  liveInnerFocused: {
    backgroundColor: Colors.primary.dark,
  },
  liveText: {
    color: Colors.surface.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.caption,
  },
});
