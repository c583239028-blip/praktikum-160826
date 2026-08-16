import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import LoginScreen from '../src/screens/LoginScreen';
import { authService } from '../src/services/auth.service';
import { connectAppSocket } from '../src/services/socket.service';
import { Platform, Alert } from 'react-native';

// ─────────────────────────────────────────────
// Mocks & Setup
// ─────────────────────────────────────────────

// משתנה מקומי פשוט שישלוט על מערכת ההפעלה בטסטים
let mockCurrentOS = 'ios';

// דריסה דינמית ובטוחה של הפרופרטי OS מבלי לשבור את שאר המודול של react-native
Object.defineProperty(Platform, 'OS', {
  get: () => mockCurrentOS,
  configurable: true,
});

// יצירת Spy על Alert.alert כדי לעקוב אחרי קריאות מבלי לשבור את ה-Mock המובנה
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

jest.mock('../src/services/auth.service', () => ({
  authService: {
    login: jest.fn(),
    loginWithApple: jest.fn(),
    loginWithFacebook: jest.fn(),
  },
}));

jest.mock('../src/services/socket.service', () => ({
  connectAppSocket: jest.fn(),
}));

// ─────────────────────────────────────────────
// עזר
// ─────────────────────────────────────────────

const mockUser = { id: 1, email: 'test@test.com', username: 'testuser' };

function renderScreen(onLoginSuccess = jest.fn()) {
  return {
    ...render(<LoginScreen onLoginSuccess={onLoginSuccess} />),
    onLoginSuccess,
  };
}

// ─────────────────────────────────────────────
// טסטים
// ─────────────────────────────────────────────

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentOS = 'ios'; // מחזירים ל-ios כברירת מחדל לפני כל טסט
    connectAppSocket.mockResolvedValue();
  });

  // ── UI ──────────────────────────────────────

  it('1. מציג את כל שדות הטופס', () => {
    const { getByPlaceholderText, getAllByText } = renderScreen();
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getAllByText('Sign In').length).toBe(2);
  });

  it('2. כפתור אפל מוצג על iOS', () => {
    mockCurrentOS = 'ios';
    const { getByText } = renderScreen();
    expect(getByText(/Continue with Apple/i)).toBeTruthy();
  });

  it('3. כפתור אפל לא מוצג על אנדרואיד', () => {
    mockCurrentOS = 'android';
    const { queryByText } = renderScreen();
    expect(queryByText(/Continue with Apple/i)).toBeNull();
  });

  it('4. כפתור פייסבוק מוצג תמיד', () => {
    const { getByText } = renderScreen();
    expect(getByText('f Continue with Facebook (Coming soon)')).toBeTruthy();
  });

  // ── handleLogin ──────────────────────────────

  it('5. שדות ריקים — מציג Alert ולא קורא לשרת', async () => {
    const { getAllByText } = renderScreen();
    await act(async () => {
      fireEvent.press(getAllByText('Sign In')[1]);
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please fill in all fields'
    );
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('6. התחברות רגילה מוצלחת — קורא onLoginSuccess', async () => {
    authService.login.mockResolvedValue({ token: 'jwt', user: mockUser });
    const { getByPlaceholderText, getAllByText, onLoginSuccess } =
      renderScreen();

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('Password'), '123456');
    await act(async () => {
      fireEvent.press(getAllByText('Sign In')[1]);
    });

    expect(authService.login).toHaveBeenCalledWith('test@test.com', '123456');
    expect(connectAppSocket).toHaveBeenCalled();
    expect(onLoginSuccess).toHaveBeenCalledWith({
      id: 1,
      email: 'test@test.com',
      username: 'testuser',
    });
  });

  it('7. שגיאת התחברות — מציג Alert עם הודעת השגיאה', async () => {
    authService.login.mockRejectedValue(new Error('Invalid credentials'));
    const { getByPlaceholderText, getAllByText } = renderScreen();

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrong');
    await act(async () => {
      fireEvent.press(getAllByText('Sign In')[1]);
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Login failed',
      'Invalid credentials'
    );
  });

  // ── handleAppleLogin ─────────────────────────

  it('8. התחברות אפל מוצלחת — קורא onLoginSuccess', async () => {
    authService.loginWithApple.mockResolvedValue({
      token: 'jwt',
      user: mockUser,
    });
    const { getByText, onLoginSuccess } = renderScreen();

    await act(async () => {
      fireEvent.press(getByText(/Continue with Apple/i));
    });

    expect(authService.loginWithApple).toHaveBeenCalled();
    expect(connectAppSocket).toHaveBeenCalled();
    expect(onLoginSuccess).toHaveBeenCalledWith({
      id: 1,
      email: 'test@test.com',
      username: 'testuser',
    });
  });

  it('9. ביטול אפל (USER_CANCELED) — שקט, לא מציג Alert', async () => {
    const cancelError = new Error('canceled');
    cancelError.code = 'USER_CANCELED';
    authService.loginWithApple.mockRejectedValue(cancelError);
    const { getByText } = renderScreen();

    await act(async () => {
      fireEvent.press(getByText(/Continue with Apple/i));
    });

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('10. שגיאת רשת באפל — מציג Alert עם Try Again', async () => {
    const networkError = new Error(
      'Network Issue: Please check your internet connection.'
    );
    networkError.code = 'NETWORK_ERROR';
    authService.loginWithApple.mockRejectedValue(networkError);
    const { getByText } = renderScreen();

    await act(async () => {
      fireEvent.press(getByText(/Continue with Apple/i));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Sign In Error',
      'Network Issue: Please check your internet connection.',
      [{ text: 'Try Again' }]
    );
  });

  it('11. Token לא תקין באפל — מציג Alert עם Try Again', async () => {
    const tokenError = new Error(
      'Authentication failure: The provided token is invalid.'
    );
    tokenError.code = 'INVALID_TOKEN';
    authService.loginWithApple.mockRejectedValue(tokenError);
    const { getByText } = renderScreen();

    await act(async () => {
      fireEvent.press(getByText(/Continue with Apple/i));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Sign In Error',
      'Authentication failure: The provided token is invalid.',
      [{ text: 'Try Again' }]
    );
  });

  it('12. חשבון קיים עם ספק אחר באפל — מציג Alert', async () => {
    const conflictError = new Error(
      'An account already exists with this email address.'
    );
    conflictError.code = 'ACCOUNT_EXISTS_DIFFERENT_PROVIDER';
    authService.loginWithApple.mockRejectedValue(conflictError);
    const { getByText } = renderScreen();

    await act(async () => {
      fireEvent.press(getByText(/Continue with Apple/i));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Sign In Error',
      'An account already exists with this email address.',
      [{ text: 'Try Again' }]
    );
  });

  // ── handleFacebookLogin ──────────────────────

  // TODO: להפעיל מחדש כשפייסבוק יהיה פעיל (Coming soon → ביטול ה-mock ב-auth.service.js)
  // it('13. התחברות פייסבוק מוצלחת — קורא onLoginSuccess', async () => {
  //   authService.loginWithFacebook.mockResolvedValue({ token: 'jwt', user: mockUser });
  //   const { getByText, onLoginSuccess } = renderScreen();

  //   await act(async () => { fireEvent.press(getByText('f Continue with Facebook (Coming soon)')); });

  //   expect(authService.loginWithFacebook).toHaveBeenCalled();
  //   expect(connectAppSocket).toHaveBeenCalled();
  //   expect(onLoginSuccess).toHaveBeenCalledWith({
  //     id: 1, email: 'test@test.com', username: 'testuser',
  //   });
  // });

  it('13. כפתור פייסבוק מושבת — לא קורא loginWithFacebook', async () => {
    const { getByText } = renderScreen();
    await act(async () => {
      fireEvent.press(getByText('f Continue with Facebook (Coming soon)'));
    });
    expect(authService.loginWithFacebook).not.toHaveBeenCalled();
  });

  // TODO: להפעיל מחדש כשפייסבוק יהיה פעיל (Coming soon → ביטול ה-mock ב-auth.service.js)
  // it('14. ביטול פייסבוק (USER_CANCELED) — שקט, לא מציג Alert', async () => {
  //   const cancelError = new Error('canceled');
  //   cancelError.code = 'USER_CANCELED';
  //   authService.loginWithFacebook.mockRejectedValue(cancelError);
  //   const { getByText } = renderScreen();

  //   await act(async () => { fireEvent.press(getByText('f Continue with Facebook (Coming soon)')); });

  //   expect(Alert.alert).not.toHaveBeenCalled();
  // });

  // TODO: להפעיל מחדש כשפייסבוק יהיה פעיל (Coming soon → ביטול ה-mock ב-auth.service.js)
  // it('15. שגיאת רשת בפייסבוק — מציג Alert עם Try Again', async () => {
  //   const networkError = new Error('Network Issue: Please check your internet connection.');
  //   networkError.code = 'NETWORK_ERROR';
  //   authService.loginWithFacebook.mockRejectedValue(networkError);
  //   const { getByText } = renderScreen();

  //   await act(async () => { fireEvent.press(getByText('f Continue with Facebook (Coming soon)')); });

  //   expect(Alert.alert).toHaveBeenCalledWith(
  //     'Sign In Error',
  //     'Network Issue: Please check your internet connection.',
  //     [{ text: 'Try Again' }]
  //   );
  // });

  // TODO: להפעיל מחדש כשפייסבוק יהיה פעיל (Coming soon → ביטול ה-mock ב-auth.service.js)
  // it('16. חשבון קיים עם ספק אחר בפייסבוק — מציג Alert', async () => {
  //   const conflictError = new Error('An account already exists with this email address.');
  //   conflictError.code = 'ACCOUNT_EXISTS_DIFFERENT_PROVIDER';
  //   authService.loginWithFacebook.mockRejectedValue(conflictError);
  //   const { getByText } = renderScreen();

  //   await act(async () => { fireEvent.press(getByText('f Continue with Facebook (Coming soon)')); });

  //   expect(Alert.alert).toHaveBeenCalledWith(
  //     'Sign In Error',
  //     'An account already exists with this email address.',
  //     [{ text: 'Try Again' }]
  //   );
  // });
});
