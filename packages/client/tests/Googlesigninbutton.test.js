import React from 'react';
import { render, act } from '@testing-library/react-native';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import GoogleSignInButton from '../src/components/GoogleSignInButton';
import { authService } from '../src/services/auth.service';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockPromptAsync = jest.fn();
const mockUseIdTokenAuthRequest = jest.fn();

jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: (...args) => mockUseIdTokenAuthRequest(...args),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: {
    credential: jest.fn().mockReturnValue('mock_google_credential'),
  },
  signInWithCredential: jest.fn(),
}));

jest.mock('../src/config/firebase', () => ({
  firebaseAuth: 'mock_firebase_auth_instance',
}));

jest.mock('../src/services/auth.service', () => ({
  authService: {
    handleAuthError: jest.fn((error) => error),
  },
}));

// ─────────────────────────────────────────────
// טסטים
// ─────────────────────────────────────────────

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIdTokenAuthRequest.mockReturnValue([
      { exists: true },
      null,
      mockPromptAsync,
    ]);
  });

  // ── UI ──────────────────────────────────────

  it('1. מציג ספינר כשהבקשה עדיין לא מוכנה', () => {
    mockUseIdTokenAuthRequest.mockReturnValue([null, null, mockPromptAsync]);
    const { UNSAFE_getByType } = render(
      <GoogleSignInButton onSuccess={jest.fn()} onError={jest.fn()} />
    );
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('2. מציג כפתור כשהבקשה מוכנה', () => {
    const { getByText } = render(
      <GoogleSignInButton onSuccess={jest.fn()} onError={jest.fn()} />
    );
    expect(getByText('Continue with Google')).toBeTruthy();
  });

  // ── תגובות סינכרוניות ────────────────────────

  it('3. אין תגובה — לא קורא onSuccess ולא onError', () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    mockUseIdTokenAuthRequest.mockReturnValue([
      { exists: true },
      null,
      mockPromptAsync,
    ]);
    render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('4. ביטול (dismiss) — לא קורא onSuccess ולא onError', () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    mockUseIdTokenAuthRequest.mockReturnValue([
      { exists: true },
      { type: 'dismiss' },
      mockPromptAsync,
    ]);
    render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('5. תגובה מסוג error — קורא onError עם שגיאה מתורגמת', () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const error = new Error('something failed');
    mockUseIdTokenAuthRequest.mockReturnValue([
      { exists: true },
      { type: 'error', error },
      mockPromptAsync,
    ]);
    render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);

    expect(authService.handleAuthError).toHaveBeenCalledWith(error); // ← חדש
    expect(onError).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  // ── תגובות אסינכרוניות ───────────────────────

  it('6. הצלחה — קורא onSuccess עם Firebase token', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const mockUser = {
      getIdToken: jest.fn().mockResolvedValue('firebase_token_abc'),
    };
    signInWithCredential.mockResolvedValue({ user: mockUser });
    mockUseIdTokenAuthRequest.mockReturnValue([
      { exists: true },
      { type: 'success', params: { id_token: 'google_id_token' } },
      mockPromptAsync,
    ]);

    render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);
    await act(async () => {});

    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith(
      'google_id_token'
    );
    expect(signInWithCredential).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith('firebase_token_abc');
    expect(onError).not.toHaveBeenCalled();
  });

  it('7. שגיאת Firebase — קורא onError עם שגיאה מתורגמת', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const firebaseError = new Error('auth error');
    firebaseError.code = 'auth/invalid-credential';
    signInWithCredential.mockRejectedValue(firebaseError);
    const handledError = new Error('handled');
    handledError.code = 'INVALID_TOKEN';
    authService.handleAuthError.mockReturnValue(handledError);
    mockUseIdTokenAuthRequest.mockReturnValue([
      { exists: true },
      { type: 'success', params: { id_token: 'google_id_token' } },
      mockPromptAsync,
    ]);

    render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);
    await act(async () => {});

    expect(authService.handleAuthError).toHaveBeenCalledWith(firebaseError);
    expect(onError).toHaveBeenCalledWith(handledError);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('8. ביטול מצד המשתמש — לא קורא onError', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const cancelError = new Error('canceled');
    cancelError.code = 'USER_CANCELED';
    signInWithCredential.mockRejectedValue(cancelError);
    authService.handleAuthError.mockReturnValue(cancelError);
    mockUseIdTokenAuthRequest.mockReturnValue([
      { exists: true },
      { type: 'success', params: { id_token: 'google_id_token' } },
      mockPromptAsync,
    ]);

    render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);
    await act(async () => {});

    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('9. onError אופציונלי — לא קורס כשלא מועבר', async () => {
    const onSuccess = jest.fn();
    const firebaseError = new Error('error');
    firebaseError.code = 'INVALID_TOKEN';
    signInWithCredential.mockRejectedValue(firebaseError);
    authService.handleAuthError.mockReturnValue(firebaseError);
    mockUseIdTokenAuthRequest.mockReturnValue([
      { exists: true },
      { type: 'success', params: { id_token: 'google_id_token' } },
      mockPromptAsync,
    ]);

    render(<GoogleSignInButton onSuccess={onSuccess} />);
    await expect(act(async () => {})).resolves.not.toThrow();
  });
});
