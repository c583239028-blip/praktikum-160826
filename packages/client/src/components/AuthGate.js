import { Redirect } from 'expo-router';
import PropTypes from 'prop-types';
import { useAuth } from '../context/AuthContext';

// Safety net: guests who deep-link straight to a protected route are bounced home (SCRUM-225).
export default function AuthGate({ children }) {
  const { isGuest, isLoading } = useAuth();

  // Wait out the async session restore before deciding the user is really a guest.
  if (isLoading) return null;

  if (isGuest) return <Redirect href="/" />;

  return children;
}

AuthGate.propTypes = {
  children: PropTypes.node.isRequired,
};
