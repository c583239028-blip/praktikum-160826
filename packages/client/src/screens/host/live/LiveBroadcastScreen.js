import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RTCView } from '@livekit/react-native-webrtc';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../../../components/game/Avatar';
import { ExitConfirmModal } from './ExitConfirmModal';
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Gradients,
} from '@/constants/design';

// Placeholder shown behind the overlay until the real camera feed is live — the
// live video will render on top of this exact spot once the media server is up.
const LIVE_PLACEHOLDER = require('../../../../assets/images/live-placeholder.png');
// Demo viewer avatars (top-right cluster). Real viewers arrive with the API;
// for now this mirrors the Figma so the live screen looks complete.
const DEMO_VIEWERS = [1, 2, 3, 4];

// Dark live-broadcast screen. Presentation + a single side effect: the broadcast
// starts automatically on entry (no "start" button — reaching this screen means
// going live). Every other bit of state/action comes from useHostBroadcast.
export function LiveBroadcastScreen({
  title,
  localStream,
  status,
  isLive,
  isClosing,
  hasError,
  viewerCount,
  showEndConfirm,
  cameraOn,
  micOn,
  startBroadcast,
  toggleCamera,
  toggleMic,
  requestEnd,
  cancelEnd,
  confirmEnd,
}) {
  const { t } = useTranslation('host');

  // Auto-start once on entry. Guarded so it never double-fires (and skips if a
  // stream is already running, e.g. re-entering an in-progress session).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStarted.current && !localStream && !isLive) {
      autoStarted.current = true;
      startBroadcast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {/* Fullscreen local camera, or the placeholder image behind it */}
      {localStream && cameraOn ? (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.videoFull}
          objectFit="cover"
        />
      ) : (
        <ImageBackground
          source={LIVE_PLACEHOLDER}
          style={styles.videoFull}
          resizeMode="cover"
        >
          {/* Scrim so the white overlay text stays legible over any photo */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.55)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      )}

      {/* Overlay UI on top of the video */}
      <SafeAreaView style={styles.uiOverlay} pointerEvents="box-none">
        {/* Top bar — Figma header: title + live dot (start),
            viewers + points badge + exit, then the viewer cluster. */}
        <View style={styles.topBar}>
          <View style={styles.titleRow}>
            <View style={styles.liveDot} />
            <Text style={styles.gameTitle} numberOfLines={1}>
              {title || t('liveTitleFallback', 'המשחק שלי')}
            </Text>
          </View>

          <View style={styles.topRight}>
            <View style={styles.statsRow}>
              <View style={styles.viewersPill}>
                <Ionicons name="eye" size={14} color={Colors.surface.white} />
                <Text style={styles.viewersText}>{viewerCount}</Text>
              </View>
              <LinearGradient
                colors={Gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.pointsBadge}
              >
                <Ionicons
                  name="diamond"
                  size={12}
                  color={Colors.surface.white}
                />
                <Text style={styles.pointsText}>1520</Text>
              </LinearGradient>
              {/* Exit — Figma power button (top corner). Opens confirmation. */}
              <TouchableOpacity
                style={styles.topExit}
                onPress={requestEnd}
                disabled={isClosing}
                accessibilityLabel={t('exitBroadcast', 'יציאה מהשידור')}
              >
                <Ionicons name="power" size={20} color={Colors.surface.white} />
              </TouchableOpacity>
            </View>

            {/* Demo viewer cluster */}
            <View style={styles.avatarsRow}>
              {DEMO_VIEWERS.map((v, i) => (
                <View
                  key={v}
                  style={[styles.avatarWrap, i > 0 && styles.avatarOverlap]}
                >
                  <Avatar size={30} />
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.flexSpacer} pointerEvents="none" />

        {/* Bottom controls: mic/camera toggles once live, else a status line
            while the broadcast is coming up (auto-started on entry). */}
        <View style={styles.bottomArea}>
          {isLive ? (
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, !micOn && styles.toggleBtnOff]}
                onPress={toggleMic}
                accessibilityLabel={t('toggleMic', 'השתקת/הפעלת מיקרופון')}
              >
                <Ionicons
                  name={micOn ? 'mic' : 'mic-off'}
                  size={26}
                  color={Colors.surface.white}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleBtn, !cameraOn && styles.toggleBtnOff]}
                onPress={toggleCamera}
                accessibilityLabel={t('toggleCamera', 'כיבוי/הפעלת מצלמה')}
              >
                <Ionicons
                  name={cameraOn ? 'videocam' : 'videocam-off'}
                  size={26}
                  color={Colors.surface.white}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.statusColumn}>
              {status ? (
                <Text style={styles.statusText} numberOfLines={2}>
                  {status}
                </Text>
              ) : null}
              {/* Auto-start can fail (camera/connection) — offer a way out
                  instead of leaving the host stuck on an error line. */}
              {hasError ? (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={startBroadcast}
                  accessibilityLabel={t('retry', 'נסה שוב')}
                >
                  <Ionicons
                    name="refresh"
                    size={18}
                    color={Colors.surface.white}
                  />
                  <Text style={styles.retryText}>{t('retry', 'נסה שוב')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </SafeAreaView>

      <ExitConfirmModal
        visible={showEndConfirm}
        onConfirm={confirmEnd}
        onCancel={cancelEnd}
      />
    </View>
  );
}

LiveBroadcastScreen.propTypes = {
  title: PropTypes.string,
  localStream: PropTypes.object,
  status: PropTypes.string,
  isLive: PropTypes.bool,
  isClosing: PropTypes.bool,
  hasError: PropTypes.bool,
  viewerCount: PropTypes.number,
  showEndConfirm: PropTypes.bool,
  cameraOn: PropTypes.bool,
  micOn: PropTypes.bool,
  startBroadcast: PropTypes.func.isRequired,
  toggleCamera: PropTypes.func.isRequired,
  toggleMic: PropTypes.func.isRequired,
  requestEnd: PropTypes.func.isRequired,
  cancelEnd: PropTypes.func.isRequired,
  confirmEnd: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Fullscreen video + placeholder
  videoFull: { ...StyleSheet.absoluteFillObject },

  // Overlay UI
  uiOverlay: { flex: 1, justifyContent: 'flex-start' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },

  // Title + live dot (top-start)
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
    paddingTop: Spacing.sm,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.success.main,
  },
  gameTitle: {
    color: Colors.surface.white,
    fontSize: FontSize.bodyL,
    fontWeight: 'bold',
    flexShrink: 1,
  },

  // Stats + exit + avatar cluster (top-end)
  topRight: { alignItems: 'flex-end', gap: Spacing.md },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  viewersPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  viewersText: {
    color: Colors.surface.white,
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  pointsText: {
    color: Colors.surface.white,
    fontSize: FontSize.caption,
    fontWeight: 'bold',
  },
  topExit: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarsRow: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: {
    borderWidth: 2,
    borderColor: Colors.surface.white,
    borderRadius: 999,
  },
  avatarOverlap: { marginStart: -Spacing.md },

  flexSpacer: { flex: 1 },

  bottomArea: {
    padding: Spacing.xl,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  statusColumn: { alignItems: 'center', gap: Spacing.md },
  statusText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.bodyM,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  retryText: {
    color: Colors.surface.white,
    fontSize: FontSize.bodyM,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    justifyContent: 'center',
  },
  toggleBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnOff: { backgroundColor: Colors.live },
});
