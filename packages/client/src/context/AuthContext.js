import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { authService } from '../services/auth.service';
import { userService } from '../services/userService';
import { setUnauthorizedHandler } from '../services/apiHelpers';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = async () => {
    try {
      const storedToken = await authService.getToken();
      if (storedToken) {
        const userData = await userService.getMe();
        setUser(userData);
        setToken(storedToken);
      }
    } catch {
      await authService.logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    const { token: jwtToken, user: userData } = await authService.login(
      email,
      password
    );
    setUser(userData);
    setToken(jwtToken);
  };

  const socialLogin = async (firebaseToken) => {
    const { token: jwtToken, user: userData } =
      await authService.loginWithSocial(firebaseToken);
    setUser(userData);
    setToken(jwtToken);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setToken(null);
  };

  useEffect(() => {
    setUnauthorizedHandler(logout);
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const updateUser = (partial) =>
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));

  const isGuest = !user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isGuest,
        isLoading,
        login,
        socialLogin,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => useContext(AuthContext);
