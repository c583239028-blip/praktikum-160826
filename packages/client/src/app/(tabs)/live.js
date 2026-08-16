import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '@worldplay/shared';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useAuth } from '../../context/AuthContext';
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
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  title: {
    color: Colors.primary.default,
    fontSize: FontSize.h1,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    color: Colors.text.tertiary,
    fontSize: FontSize.bodyM,
    marginTop: Spacing.sm,
  },
  errorText: {
    color: Colors.error.main,
    fontSize: FontSize.caption,
    marginTop: Spacing.md,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyList: {
    justifyContent: 'center',
  },
  cardContainer: {
    position: 'relative',
  },
  joiningOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(Colors.surface.dark, 0.6),
  },
});
