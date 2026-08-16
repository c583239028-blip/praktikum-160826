import AuthGate from '../components/AuthGate';
import { HostFlow } from '../screens/host/HostFlow';

// Host entry — AuthGate bounces guests (SCRUM-225) around the create-game
// wizard → live broadcast (the refactored flow). Keep the AuthGate wrapper;
// only the inner screen changed (HostScreen → HostFlow).
export default function Page() {
  return (
    <AuthGate>
      <HostFlow />
    </AuthGate>
  );
}
