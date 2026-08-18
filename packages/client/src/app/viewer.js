import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ViewerScreen from '../screens/ViewerScreen';
import LazyAuthModal from '../components/LazyAuthModal';

export default function ViewerPage() {
  const { isGuest } = useAuth();
  const [modalVisible, setModalVisible] = useState(true);

  return (
    <>
      <ViewerScreen />
      {isGuest && (
        <LazyAuthModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />
      )}
    </>
  );
}
