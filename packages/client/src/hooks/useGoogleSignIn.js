import { useEffect, useRef } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth } from '../config/firebase';
import { authService } from '../services/auth.service';

WebBrowser.maybeCompleteAuthSession();

/**
 * Shared Google sign-in logic (used by GoogleSignInButton and LazyAuthModal).
 * Runs the Google OAuth flow, signs into Firebase, and returns the Firebase ID
 * token via onSuccess. Returns { request, promptAsync } so callers provide their
 * own button UI.
 */
export function useGoogleSignIn({ onSuccess, onError } = {}) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  // Keep latest callbacks in refs so the response effect depends ONLY on
  // `response` — otherwise unstable callbacks (e.g. AuthContext.socialLogin)
  // re-run the effect and re-process the same response in a loop.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!response) return;
    if (response.type === 'dismiss') return;
    if (response.type === 'error') {
      onErrorRef.current?.(
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
      .then((firebaseToken) => onSuccessRef.current?.(firebaseToken))
      .catch((err) => {
        const handled = authService.handleAuthError(err);
        if (handled.code !== 'USER_CANCELED') {
          onErrorRef.current?.(handled);
        }
      });
  }, [response]);

  return { request, promptAsync };
}
