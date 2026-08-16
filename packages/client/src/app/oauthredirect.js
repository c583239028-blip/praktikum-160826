import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

// Completes the pending OAuth session so the auth request that opened the
// browser resolves, instead of this redirect falling through to an
// "Unmatched Route".
WebBrowser.maybeCompleteAuthSession();

export default function OAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), 50);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}
