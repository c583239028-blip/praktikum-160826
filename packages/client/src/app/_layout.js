import '../i18n';
import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from '../store/index';
import { AuthProvider } from '../context/AuthContext';
import { applyPendingRTLReload } from '../i18n';

import { Colors } from '../../constants/design';
export default function RootLayout() {
  useEffect(() => {
    // Trigger any RTL-driven reload only after the tree has mounted AND
    // native interactions have settled. Calling Updates.reloadAsync() any
    // earlier races with native module registration on the New Architecture
    // (cold-start crash) or with an OS-level activity recreation triggered
    // by a live device-locale change (freeze). See i18n.js for details.
    const handle = InteractionManager.runAfterInteractions(() => {
      applyPendingRTLReload();
    });

    return () => handle.cancel?.();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Provider store={store}>
          <Stack
            screenOptions={{
              headerShown: false,
              // TODO(responsive-ui-infra-task): dark is a temporary camera placeholder —
              // flip to Colors.surface.white when migrating screens to design.js tokens.
              contentStyle: { backgroundColor: Colors.surface.white },
            }}
          />
        </Provider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
