/**
 * auth.service.test.js
 *
 * Comprehensive test suite for auth.service.js.
 * Covers: login, loginWithSocial, loginWithApple, getToken,
 *         isAuthenticated, logout, handleAuthError
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithCredential, OAuthProvider } from 'firebase/auth';
import { handleResponse } from '../src/services/apiHelpers.js';
import { authService } from '../src/services/auth.service.js';
import { ERROR_MESSAGES } from '@worldplay/shared/src/constants/errors.js';

// ─────────────────────────────────────────────────────────────────────────────
// Global Mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32).fill(1)),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 'FULL_NAME', EMAIL: 'EMAIL' },
}));

jest.mock('firebase/auth', () => ({
  OAuthProvider: jest.fn().mockImplementation(() => ({
    credential: jest.fn().mockReturnValue('mock_firebase_credential'),
  })),
  signInWithCredential: jest.fn(),
}));

jest.mock('../src/config/firebase', () => ({
  firebaseAuth: 'mock_firebase_auth_instance',
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../src/services/apiHelpers', () => ({
  handleResponse: jest.fn(),
}));

// Stable fetch mock — overridden per test where needed
global.fetch = jest.fn();

// ─────────────────────────────────────────────────────────────────────────────
// handleAuthError
// ─────────────────────────────────────────────────────────────────────────────

describe('authService.handleAuthError', () => {
  // ── Cancellation ──────────────────────────────────────────────────────────

  describe('Cancellation errors → USER_CANCELED', () => {
    it('returns USER_CANCELED for auth/popup-closed-by-user', () => {
      const error = Object.assign(new Error('popup closed'), {
        code: 'auth/popup-closed-by-user',
      });
      expect(authService.handleAuthError(error).code).toBe('USER_CANCELED');
    });

    it('returns USER_CANCELED for auth/cancelled-popup-request', () => {
      const error = Object.assign(new Error('cancelled'), {
        code: 'auth/cancelled-popup-request',
      });
      expect(authService.handleAuthError(error).code).toBe('USER_CANCELED');
    });

    it('returns USER_CANCELED for ERR_CANCELED error code', () => {
      const error = Object.assign(new Error('err canceled'), {
        code: 'ERR_CANCELED',
      });
      expect(authService.handleAuthError(error).code).toBe('USER_CANCELED');
    });

    it('returns USER_CANCELED when message includes ERR_REQUEST_CANCELED', () => {
      const error = new Error('ERR_REQUEST_CANCELED something happened');
      expect(authService.handleAuthError(error).code).toBe('USER_CANCELED');
    });

    it('returns USER_CANCELED when message includes "canceled" (case-insensitive)', () => {
      const error = new Error('The user Canceled the operation');
      expect(authService.handleAuthError(error).code).toBe('USER_CANCELED');
    });

    it('USER_CANCELED message is human-readable', () => {
      const error = Object.assign(new Error('popup closed'), {
        code: 'auth/popup-closed-by-user',
      });
      expect(authService.handleAuthError(error).message).toMatch(/canceled/i);
    });
  });

  // ── Network ───────────────────────────────────────────────────────────────

  describe('Network errors → NETWORK_ERROR', () => {
    it('returns NETWORK_ERROR for auth/network-request-failed', () => {
      const error = Object.assign(new Error('net fail'), {
        code: 'auth/network-request-failed',
      });
      expect(authService.handleAuthError(error).code).toBe('NETWORK_ERROR');
    });

    it('returns NETWORK_ERROR when message includes "network request failed" (case-insensitive)', () => {
      const error = new Error('Network request failed');
      expect(authService.handleAuthError(error).code).toBe('NETWORK_ERROR');
    });

    it('returns NETWORK_ERROR when message includes "failed to fetch"', () => {
      const error = new Error('Failed to fetch');
      expect(authService.handleAuthError(error).code).toBe('NETWORK_ERROR');
    });

    it('NETWORK_ERROR message mentions internet connection', () => {
      const error = new Error('failed to fetch');
      expect(authService.handleAuthError(error).message).toMatch(
        /internet connection/i
      );
    });
  });

  // ── Invalid Token ─────────────────────────────────────────────────────────

  describe('Invalid credential errors → INVALID_TOKEN', () => {
    it('returns INVALID_TOKEN for auth/invalid-credential', () => {
      const error = Object.assign(new Error('bad cred'), {
        code: 'auth/invalid-credential',
      });
      expect(authService.handleAuthError(error).code).toBe('INVALID_TOKEN');
    });

    it('returns INVALID_TOKEN for auth/invalid-verification-code', () => {
      const error = Object.assign(new Error('bad code'), {
        code: 'auth/invalid-verification-code',
      });
      expect(authService.handleAuthError(error).code).toBe('INVALID_TOKEN');
    });

    it('INVALID_TOKEN message mentions "invalid"', () => {
      const error = Object.assign(new Error('x'), {
        code: 'auth/invalid-credential',
      });
      expect(authService.handleAuthError(error).message).toMatch(/invalid/i);
    });
  });

  // ── Account Conflict ──────────────────────────────────────────────────────

  describe('Account conflict → ACCOUNT_EXISTS_DIFFERENT_PROVIDER', () => {
    it('returns ACCOUNT_EXISTS_DIFFERENT_PROVIDER for auth/account-exists-with-different-credential', () => {
      const error = Object.assign(new Error('conflict'), {
        code: 'auth/account-exists-with-different-credential',
      });
      expect(authService.handleAuthError(error).code).toBe(
        'ACCOUNT_EXISTS_DIFFERENT_PROVIDER'
      );
    });

    it('ACCOUNT_EXISTS_DIFFERENT_PROVIDER message mentions email address', () => {
      const error = Object.assign(new Error('x'), {
        code: 'auth/account-exists-with-different-credential',
      });
      expect(authService.handleAuthError(error).message).toMatch(
        /email address/i
      );
    });
  });

  // ── Unknown / Pass-through ────────────────────────────────────────────────

  describe('Unknown errors → returned as-is', () => {
    it('returns the original error object for unrecognized error codes', () => {
      const error = Object.assign(new Error('something unexpected'), {
        code: 'unknown/error',
      });
      expect(authService.handleAuthError(error)).toBe(error);
    });

    it('returns the original error when message is unrelated and code is absent', () => {
      const error = new Error('totally unrelated');
      expect(authService.handleAuthError(error)).toBe(error);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// login
// ─────────────────────────────────────────────────────────────────────────────

describe('authService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockOkResponse = (body) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    });

  const mockErrorResponse = (body, status = 400) =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve(body),
    });

  it('sends POST to /api/users/login with email and password', async () => {
    global.fetch.mockReturnValueOnce(
      mockOkResponse({ token: 'tok', user: { id: 1 } })
    );
    await authService.login('user@test.com', 'pass123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/login'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@test.com', password: 'pass123' }),
      })
    );
  });

  it('stores token in AsyncStorage on success', async () => {
    global.fetch.mockReturnValueOnce(
      mockOkResponse({ token: 'my_token', user: { id: 1 } })
    );
    await authService.login('user@test.com', 'pass');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('userToken', 'my_token');
  });

  it('returns token and user on success', async () => {
    global.fetch.mockReturnValueOnce(
      mockOkResponse({ token: 'my_token', user: { id: 42, name: 'Alice' } })
    );
    const result = await authService.login('user@test.com', 'pass');
    expect(result).toEqual({
      token: 'my_token',
      user: { id: 42, name: 'Alice' },
    });
  });

  it('throws with server message when response is not ok', async () => {
    global.fetch.mockReturnValueOnce(
      mockErrorResponse({ message: 'Invalid credentials' })
    );
    await expect(authService.login('bad@test.com', 'wrong')).rejects.toThrow(
      'Invalid credentials'
    );
  });

  it('throws a fallback message when server provides no message', async () => {
    global.fetch.mockReturnValueOnce(mockErrorResponse({}));
    await expect(authService.login('bad@test.com', 'wrong')).rejects.toThrow(
      'Login failed'
    );
  });

  it('throws when response is ok but no token is returned', async () => {
    global.fetch.mockReturnValueOnce(
      mockOkResponse({ user: { id: 1 } }) // no token field
    );
    await expect(authService.login('user@test.com', 'pass')).rejects.toThrow(
      'No token received from server'
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('does not store token when login fails', async () => {
    global.fetch.mockReturnValueOnce(
      mockErrorResponse({ message: ERROR_MESSAGES.UNAUTHORIZED })
    );
    await authService.login('u@t.com', 'p').catch(() => {});
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// loginWithSocial
// ─────────────────────────────────────────────────────────────────────────────

describe('authService.loginWithSocial', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the firebase token to /api/auth/social', async () => {
    handleResponse.mockResolvedValue({ token: 'srv_tok', user: { id: 5 } });
    global.fetch.mockResolvedValue({ ok: true });

    await authService.loginWithSocial('firebase_token_abc');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/social'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseToken: 'firebase_token_abc' }),
      })
    );
  });

  it('stores the server token in AsyncStorage on success', async () => {
    handleResponse.mockResolvedValue({ token: 'srv_tok', user: { id: 5 } });
    global.fetch.mockResolvedValue({ ok: true });

    await authService.loginWithSocial('firebase_token_abc');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('userToken', 'srv_tok');
  });

  it('returns token and user on success', async () => {
    handleResponse.mockResolvedValue({ token: 'srv_tok', user: { id: 5 } });
    global.fetch.mockResolvedValue({ ok: true });

    const result = await authService.loginWithSocial('firebase_token_abc');
    expect(result).toEqual({ token: 'srv_tok', user: { id: 5 } });
  });

  it('throws when server returns no token', async () => {
    handleResponse.mockResolvedValue({ user: { id: 5 } }); // no token
    global.fetch.mockResolvedValue({ ok: true });

    await expect(
      authService.loginWithSocial('firebase_token_abc')
    ).rejects.toThrow('No token received from server');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('propagates errors thrown by handleResponse', async () => {
    global.fetch.mockResolvedValue({ ok: false });
    handleResponse.mockRejectedValue(new Error(ERROR_MESSAGES.UNAUTHORIZED));

    await expect(authService.loginWithSocial('bad_token')).rejects.toThrow(
      ERROR_MESSAGES.UNAUTHORIZED
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// loginWithApple
// ─────────────────────────────────────────────────────────────────────────────

describe('authService.loginWithApple', () => {
  let loginWithSocialSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    loginWithSocialSpy = jest
      .spyOn(authService, 'loginWithSocial')
      .mockResolvedValue({
        token: 'mock_server_session_token',
        user: { id: 1 },
      });
  });

  afterAll(() => loginWithSocialSpy.mockRestore());

  // ── Happy path ────────────────────────────────────────────────────────────

  it('completes the full login flow successfully on iOS', async () => {
    Crypto.digestStringAsync.mockResolvedValue('hashed_nonce_123');
    AppleAuthentication.signInAsync.mockResolvedValue({
      identityToken: 'apple_identity_token_456',
    });
    const mockFirebaseUser = {
      getIdToken: jest.fn().mockResolvedValue('firebase_id_token_789'),
    };
    signInWithCredential.mockResolvedValue({ user: mockFirebaseUser });

    const result = await authService.loginWithApple();

    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      expect.any(String)
    );
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        nonce: 'hashed_nonce_123',
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
    );
    expect(signInWithCredential).toHaveBeenCalledWith(
      'mock_firebase_auth_instance',
      'mock_firebase_credential'
    );
    expect(loginWithSocialSpy).toHaveBeenCalledWith('firebase_id_token_789');
    expect(result).toEqual({
      token: 'mock_server_session_token',
      user: { id: 1 },
    });
  });

  it('passes the hashed nonce to Apple and the raw nonce to Firebase', async () => {
    Crypto.digestStringAsync.mockResolvedValue('hashed_nonce_xyz');
    AppleAuthentication.signInAsync.mockResolvedValue({
      identityToken: 'apple_token',
    });
    const mockUser = {
      getIdToken: jest.fn().mockResolvedValue('firebase_token'),
    };
    signInWithCredential.mockResolvedValue({ user: mockUser });

    await authService.loginWithApple();

    // Hashed nonce → Apple
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'hashed_nonce_xyz' })
    );

    // Raw nonce (hex string, not the hashed one) → Firebase OAuthProvider credential
    const oauthInstance = OAuthProvider.mock.results[0].value;
    expect(oauthInstance.credential).toHaveBeenCalledWith(
      expect.objectContaining({
        idToken: 'apple_token',
        rawNonce: expect.not.stringMatching('hashed_nonce_xyz'),
      })
    );
  });

  it('constructs the raw nonce as a hex string from 32 random bytes', async () => {
    // Fill with 0x01 → each byte becomes "01" → 64-char hex string
    Crypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(32).fill(1));
    Crypto.digestStringAsync.mockResolvedValue('hashed');
    AppleAuthentication.signInAsync.mockResolvedValue({ identityToken: 'tok' });
    const mockUser = {
      getIdToken: jest.fn().mockResolvedValue('firebase_tok'),
    };
    signInWithCredential.mockResolvedValue({ user: mockUser });

    await authService.loginWithApple();

    const oauthInstance = OAuthProvider.mock.results[0].value;
    const { rawNonce } = oauthInstance.credential.mock.calls[0][0];
    expect(rawNonce).toMatch(/^[0-9a-f]{64}$/);
  });

  // ── Platform guard ────────────────────────────────────────────────────────

  it('throws immediately on Android without calling any Apple API', async () => {
    Platform.OS = 'android';

    await expect(authService.loginWithApple()).rejects.toThrow(
      'Apple Sign-In is only supported on iOS devices.'
    );
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
  });

  // ── Missing identity token ────────────────────────────────────────────────

  it('throws a clear error when Apple returns null identityToken', async () => {
    Crypto.digestStringAsync.mockResolvedValue('hashed_nonce_123');
    AppleAuthentication.signInAsync.mockResolvedValue({ identityToken: null });

    await expect(authService.loginWithApple()).rejects.toThrow(
      'Apple Sign-In failed - no identity token received.'
    );
    expect(signInWithCredential).not.toHaveBeenCalled();
    expect(loginWithSocialSpy).not.toHaveBeenCalled();
  });

  it('throws a clear error when identityToken is undefined', async () => {
    Crypto.digestStringAsync.mockResolvedValue('hashed_nonce_123');
    AppleAuthentication.signInAsync.mockResolvedValue({});

    await expect(authService.loginWithApple()).rejects.toThrow(
      'Apple Sign-In failed - no identity token received.'
    );
  });

  // ── User cancellation ─────────────────────────────────────────────────────

  it('throws USER_CANCELED when user dismisses the Apple sheet (ERR_CANCELED)', async () => {
    Crypto.digestStringAsync.mockResolvedValue('hashed_nonce_123');
    const cancelError = Object.assign(new Error('canceled'), {
      code: 'ERR_CANCELED',
    });
    AppleAuthentication.signInAsync.mockRejectedValue(cancelError);

    const error = await authService.loginWithApple().catch((e) => e);
    expect(error.code).toBe('USER_CANCELED');
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it('throws USER_CANCELED for auth/cancelled-popup-request from Apple sheet', async () => {
    Crypto.digestStringAsync.mockResolvedValue('hashed_nonce_123');
    const cancelError = Object.assign(new Error('cancelled'), {
      code: 'auth/cancelled-popup-request',
    });
    AppleAuthentication.signInAsync.mockRejectedValue(cancelError);

    const error = await authService.loginWithApple().catch((e) => e);
    expect(error.code).toBe('USER_CANCELED');
  });

  // ── Firebase failure ──────────────────────────────────────────────────────

  it('throws INVALID_TOKEN when Firebase rejects with auth/invalid-credential', async () => {
    Crypto.digestStringAsync.mockResolvedValue('hashed_nonce_123');
    AppleAuthentication.signInAsync.mockResolvedValue({
      identityToken: 'apple_token',
    });
    signInWithCredential.mockRejectedValue(
      Object.assign(new Error('bad cred'), { code: 'auth/invalid-credential' })
    );

    const error = await authService.loginWithApple().catch((e) => e);
    expect(error.code).toBe('INVALID_TOKEN');
    expect(loginWithSocialSpy).not.toHaveBeenCalled();
  });

  it('throws ACCOUNT_EXISTS_DIFFERENT_PROVIDER when Firebase reports a credential conflict', async () => {
    Crypto.digestStringAsync.mockResolvedValue('hashed_nonce_123');
    AppleAuthentication.signInAsync.mockResolvedValue({
      identityToken: 'apple_token',
    });
    signInWithCredential.mockRejectedValue(
      Object.assign(new Error('conflict'), {
        code: 'auth/account-exists-with-different-credential',
      })
    );

    const error = await authService.loginWithApple().catch((e) => e);
    expect(error.code).toBe('ACCOUNT_EXISTS_DIFFERENT_PROVIDER');
    expect(loginWithSocialSpy).not.toHaveBeenCalled();
  });

  // ── Network failure ───────────────────────────────────────────────────────

  it('throws NETWORK_ERROR when a network failure occurs during Firebase sign-in', async () => {
    Crypto.digestStringAsync.mockResolvedValue('hashed_nonce_123');
    AppleAuthentication.signInAsync.mockResolvedValue({
      identityToken: 'apple_token',
    });
    signInWithCredential.mockRejectedValue(
      Object.assign(new Error('Network request failed'), {
        code: 'auth/network-request-failed',
      })
    );

    const error = await authService.loginWithApple().catch((e) => e);
    expect(error.code).toBe('NETWORK_ERROR');
  });

  // ── Crypto failure ────────────────────────────────────────────────────────

  it('throws when nonce hashing fails, before calling Apple', async () => {
    Crypto.digestStringAsync.mockRejectedValue(new Error('Crypto failure'));

    await expect(authService.loginWithApple()).rejects.toThrow(
      'Crypto failure'
    );
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
  });

  it('throws when random byte generation fails', async () => {
    Crypto.getRandomBytesAsync.mockRejectedValue(new Error('RNG failure'));

    await expect(authService.loginWithApple()).rejects.toThrow('RNG failure');
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getToken
// ─────────────────────────────────────────────────────────────────────────────

describe('authService.getToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the token stored in AsyncStorage', async () => {
    AsyncStorage.getItem.mockResolvedValue('stored_token');
    const token = await authService.getToken();
    expect(token).toBe('stored_token');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('userToken');
  });

  it('returns null when no token is stored', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const token = await authService.getToken();
    expect(token).toBeNull();
  });

  it('returns null when AsyncStorage throws', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('storage error'));
    const token = await authService.getToken();
    expect(token).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isAuthenticated
// ─────────────────────────────────────────────────────────────────────────────

describe('authService.isAuthenticated', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true when a token exists in AsyncStorage', async () => {
    AsyncStorage.getItem.mockResolvedValue('some_token');
    expect(await authService.isAuthenticated()).toBe(true);
  });

  it('returns false when no token is stored (null)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    expect(await authService.isAuthenticated()).toBe(false);
  });

  it('returns false when AsyncStorage throws', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('storage unavailable'));
    expect(await authService.isAuthenticated()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// logout
// ─────────────────────────────────────────────────────────────────────────────

describe('authService.logout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes the userToken from AsyncStorage', async () => {
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    await authService.logout();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userToken');
  });

  it('resolves without throwing when AsyncStorage.removeItem throws', async () => {
    AsyncStorage.removeItem.mockRejectedValue(new Error('storage error'));
    await expect(authService.logout()).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// authService contract — real module integrity
// ─────────────────────────────────────────────────────────────────────────────
describe('authService contract', () => {
  it('handleAuthError is exported as a function', () => {
    const { authService: realService } = jest.requireActual(
      '../src/services/auth.service.js'
    );
    expect(typeof realService.handleAuthError).toBe('function');
  });
});
