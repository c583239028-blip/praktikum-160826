import { renderHook, act, waitFor } from '@testing-library/react-native';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { useGoogleSignIn } from '../src/hooks/useGoogleSignIn';
import { authService } from '../src/services/auth.service';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockConfigure = jest.fn();
const mockHasPlayServices = jest.fn().mockResolvedValue(true);
const mockSignOut = jest.fn().mockResolvedValue(null);
const mockSignIn = jest.fn();

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (...args) => mockConfigure(...args),
    hasPlayServices: (...args) => mockHasPlayServices(...args),
    signOut: (...args) => mockSignOut(...args),
    signIn: (...args) => mockSignIn(...args),
  },
  isSuccessResponse: (response) => response?.type === 'success',
  isErrorWithCode: (error) => Boolean(error?.code),
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
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

const success = (idToken) => ({ type: 'success', data: { idToken } });

const prompt = async (cbs) => {
  const { result } = renderHook(() => useGoogleSignIn(cbs));
  await act(async () => {
    await result.current.promptAsync();
  });
  return result;
};

// ─────────────────────────────────────────────
// טסטים
// ─────────────────────────────────────────────

describe('useGoogleSignIn (native Google Sign-In)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasPlayServices.mockResolvedValue(true);
    mockSignOut.mockResolvedValue(null);
  });

  it('1. חושף request מוכן ו-promptAsync (configure סינכרוני)', () => {
    const { result } = renderHook(() =>
      useGoogleSignIn({ onSuccess: jest.fn() })
    );
    expect(result.current.request).toBe(true);
    expect(typeof result.current.promptAsync).toBe('function');
  });

  it('2. מנקה סשן (signOut) לפני signIn — כדי שלא ימוחזר בין ניסיונות', async () => {
    mockSignIn.mockResolvedValue({ type: 'cancelled', data: null });
    await prompt({ onSuccess: jest.fn(), onError: jest.fn() });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('3. ביטול (הבורר נסגר) — לא קורא onSuccess ולא onError', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    mockSignIn.mockResolvedValue({ type: 'cancelled', data: null });

    await prompt({ onSuccess, onError });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('4. אין idToken — קורא onError עם שגיאה מתורגמת', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    mockSignIn.mockResolvedValue(success(null));

    await prompt({ onSuccess, onError });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(authService.handleAuthError).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('5. הצלחה — קורא onSuccess עם Firebase token', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const mockUser = {
      getIdToken: jest.fn().mockResolvedValue('firebase_token_abc'),
    };
    signInWithCredential.mockResolvedValue({ user: mockUser });
    mockSignIn.mockResolvedValue(success('google_id_token'));

    await prompt({ onSuccess, onError });

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith(
      'google_id_token'
    );
    expect(signInWithCredential).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith('firebase_token_abc');
    expect(onError).not.toHaveBeenCalled();
  });

  it('6. שגיאת Firebase — קורא onError עם שגיאה מתורגמת', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const firebaseError = new Error('auth error');
    firebaseError.code = 'auth/invalid-credential';
    signInWithCredential.mockRejectedValue(firebaseError);
    const handledError = new Error('handled');
    handledError.code = 'INVALID_TOKEN';
    authService.handleAuthError.mockReturnValue(handledError);
    mockSignIn.mockResolvedValue(success('google_id_token'));

    await prompt({ onSuccess, onError });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(authService.handleAuthError).toHaveBeenCalledWith(firebaseError);
    expect(onError).toHaveBeenCalledWith(handledError);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('7. ביטול מצד המשתמש (statusCode) — לא קורא onError', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const cancelError = new Error('canceled');
    cancelError.code = 'SIGN_IN_CANCELLED';
    mockSignIn.mockRejectedValue(cancelError);

    await prompt({ onSuccess, onError });

    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('8. onError אופציונלי — לא קורס כשלא מועבר', async () => {
    const firebaseError = new Error('error');
    firebaseError.code = 'INVALID_TOKEN';
    signInWithCredential.mockRejectedValue(firebaseError);
    authService.handleAuthError.mockReturnValue(firebaseError);
    mockSignIn.mockResolvedValue(success('google_id_token'));

    await expect(prompt({ onSuccess: jest.fn() })).resolves.toBeDefined();
  });
});
