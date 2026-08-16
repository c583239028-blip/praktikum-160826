import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// TODO: תלות ב-T16 — StreamCard (מנוטרל זמנית עד שהתיקון יתמזג)
// import StreamCard from '../../components/StreamCard';
import { useRouter } from 'expo-router';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import LazyAuthModal from '../../components/LazyAuthModal';
import DevPreviewScreen from '../../screens/DevPreviewScreen';

export default function LiveScreen() {
  return <DevPreviewScreen/>
  
  // const router = useRouter();
  // const { guardedAction, isModalVisible, closeAuthModal } = useAuthGuard();

  // return (
  //   <View style={styles.container}>
  //     {/* TODO: תלות ב-T16 — מנוטרל זמנית; StreamCard דורש prop `stream` ועדיין אין נתונים
  //     <View style={{ width: '100%', marginBottom: 10 }}>
  //       <StreamCard onPress={() => console.log('Card pressed!')} />
  //     </View>
  //     */}
  //     <Text style={styles.title}>LIVE</Text>
  //     <Text style={styles.subtitle}>כנסי לפי הרול שלך</Text>

  //     {/* TODO: להחליף בניווט אוטומטי לפי רול כש-AuthContext יהיה מוכן */}
  //     <TouchableOpacity
  //       style={styles.button}
  //       onPress={() => guardedAction(() => router.push('/host'))}
  //     >
  //       <Text style={styles.buttonText}>כנסי כ-Host</Text>
  //     </TouchableOpacity>

  //     <TouchableOpacity
  //       style={[styles.button, styles.viewerButton]}
  //       onPress={() => router.push('/viewer_test')}
  //     >
  //       <Text style={styles.buttonText}>כנסי כ-Viewer</Text>
  //     </TouchableOpacity>

  //     <LazyAuthModal visible={isModalVisible} onClose={closeAuthModal} />
  //   </View>
  // );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: '#06b6d4',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#06b6d4',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 24,
    width: 200,
    alignItems: 'center',
  },
  viewerButton: {
    backgroundColor: '#3a3a3a',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
