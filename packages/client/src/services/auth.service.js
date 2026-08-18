/**
 * auth.service.js
 *
 * Authentication service — handles login, logout, and token storage in AsyncStorage.
 *
 * Communicates with: /api/users (login), /api/auth (social login)
 * Depends on: AsyncStorage (token storage), fetch (HTTP requests)
 * Used by: LoginScreen and any screen that needs the current auth token
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth } from '../config/firebase';
import { handleResponse } from './apiHelpers';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/users`;
const AUTH_URL = `${API_BASE_URL}/api/auth`;

export const authService = {
  handleAuthError: (error) => {
    if (
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request' ||
      error.code === 'ERR_CANCELED' ||
      error.message?.includes('ERR_REQUEST_CANCELED') ||
      error.message?.toLowerCase().includes('canceled')
    ) {
      const cancellationError = new Error(
        'The login process was canceled by the user.'
      );
      cancellationError.code = 'USER_CANCELED';
      return cancellationError;
    }

    if (
      error.code === 'auth/network-request-failed' ||
      error.message?.toLowerCase().includes('network request failed') ||
      error.message?.toLowerCase().includes('failed to fetch')
    ) {
      const networkError = new Error(
        'Network Issue: Please check your internet connection and try again.'
      );
      networkError.code = 'NETWORK_ERROR';
      return networkError;
    }

    if (
      error.code === 'auth/invalid-credential' ||
      error.code === 'auth/invalid-verification-code'
    ) {
      const credentialsError = new Error(
        'Authentication failure: The provided token is invalid. Please retry.'
      );
      credentialsError.code = 'INVALID_TOKEN';
      return credentialsError;
    }

    if (error.code === 'auth/account-exists-with-different-credential') {
      const conflictError = new Error(
        'An account already exists with this email address under a different login method. Please use your original login provider.'
      );
      conflictError.code = 'ACCOUNT_EXISTS_DIFFERENT_PROVIDER';
      return conflictError;
    }

    return error;
  },

  login: async (email, password) => {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    if (data.token) {
      await AsyncStorage.setItem('userToken', data.token);
      return {
        token: data.token,
        user: data.user,
      };
    }

    throw new Error('No token received from server');
  },

  loginWithSocial: async (firebaseToken) => {
    const response = await fetch(`${AUTH_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebaseToken }),
    });

    const data = await handleResponse(response);

    if (data.token) {
      await AsyncStorage.setItem('userToken', data.token);
      return { token: data.token, user: data.user };
    }

    throw new Error('No token received from server');
  },

  getToken: async () => {
    try {
      return await AsyncStorage.getItem('userToken');
    } catch {
      return null;
    }
  },

  isAuthenticated: async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return token !== null;
    } catch {
      return false;
    }
  },

  // loginWithFacebook: async (accessToken) => {
  //   try {
  //     const credential = FacebookAuthProvider.credential(accessToken);
  //     const result = await signInWithCredential(firebaseAuth, credential);
  //     const firebaseToken = await result.user.getIdToken();
  //     return authService.loginWithSocial(firebaseToken);
  //   } catch (error) {
  //     throw authService.handleAuthError(error);
  //   }
  // },

  loginWithApple: async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only supported on iOS devices.');
    }

    try {
      const rawNonceBytes = await Crypto.getRandomBytesAsync(32);
      const rawNonce = Array.from(rawNonceBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const { identityToken } = appleCredential;
      if (!identityToken) {
        throw new Error('Apple Sign-In failed - no identity token received.');
      }

      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce: rawNonce,
      });

      const result = await signInWithCredential(firebaseAuth, credential);
      const firebaseToken = await result.user.getIdToken();

      return await authService.loginWithSocial(firebaseToken);
    } catch (error) {
      if (
        error.message === 'Apple Sign-In failed - no identity token received.'
      ) {
        throw error;
      }
      throw authService.handleAuthError(error);
    }
  },

  logout: async () => {
    try {
      await AsyncStorage.removeItem('userToken');
    } catch {
      // nothing to do if token removal failed
    }
  },
};
