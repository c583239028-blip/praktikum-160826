import PropTypes from 'prop-types';
import { useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth } from '../config/firebase';
import { authService } from '../services/auth.service';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignInButton({ onSuccess, onError }) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'dismiss') return;
    if (response.type === 'error') {
      onError?.(
        authService.handleAuthError(
          response.error ?? new Error('Google Sign-In failed')
        )
      );
      return;
    }
    if (response.type !== 'success') return;

    const { id_token } = response.params;
    const credential = GoogleAuthProvider.credential(id_token);

    signInWithCredential(firebaseAuth, credential)
      .then((result) => result.user.getIdToken())
      .then((firebaseToken) => onSuccess(firebaseToken))
      .catch((err) => {
        const handled = authService.handleAuthError(err);
        if (handled.code !== 'USER_CANCELED') {
          onError?.(handled);
        }
      });
  }, [response, onSuccess, onError]);

  return (
    <TouchableOpacity
      style={[styles.button, !request && styles.disabled]}
      onPress={() => promptAsync()}
      disabled={!request}
      activeOpacity={0.8}
    >
      {!request ? (
        <ActivityIndicator size="small" color="#666" />
      ) : (
        <Text style={styles.text}>Continue with Google</Text>
      )}
    </TouchableOpacity>
  );
}

GoogleSignInButton.propTypes = {
  onSuccess: PropTypes.func.isRequired,
  onError: PropTypes.func,
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});
