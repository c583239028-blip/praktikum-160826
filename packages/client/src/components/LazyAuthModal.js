import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { logger } from '@worldplay/shared';
import { Colors, Spacing, BorderRadius, TextStyles } from '@/constants/design';
import { RegisterButton } from './RegisterButton';
import CloseIcon from '@/assets/icons/close.svg';
import GoogleIcon from '@/assets/icons/google.svg';
import AppleIcon from '@/assets/icons/apple.svg';
import FacebookIcon from '@/assets/icons/facebook.svg';
import XIcon from '@/assets/icons/x.svg';
import InstagramIcon from '@/assets/icons/instagram.svg';
import PropTypes from 'prop-types';
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

// Missing client IDs are a permanent failure, not a slow one — this is just long
// enough that a healthy request always wins the race.
const AUTH_REQUEST_TIMEOUT_MS = 5000;

export default function LazyAuthModal({ visible, onClose }) {
  const { t } = useTranslation('auth');

  const { socialLogin } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState(null);
  // Kept separate from authError so it can clear itself once the request arrives.
  const [authUnavailable, setAuthUnavailable] = useState(false);

  // Don't call onClose() here: once socialLogin flips isGuest→false, useAuthGuard's
  // effect runs the pending action (the deferred navigation) and closes the modal.
  // Closing here would clear pendingActionRef first and lose that action.
  const handleGoogleSuccess = useCallback(
    async (firebaseToken) => {
      try {
        setIsAuthenticating(true);
        await socialLogin(firebaseToken);
      } catch (error) {
        logger.error('Social login failed:', error?.message || error);
        setAuthError(t('login_failed'));
      } finally {
        setIsAuthenticating(false);
      }
    },
    [socialLogin, t]
  );

  const handleGoogleError = useCallback(
    (err) => {
      logger.error('Google sign-in error:', err?.message || err);
      setAuthError(t('login_failed'));
      setIsAuthenticating(false);
    },
    [t]
  );

  const { request: googleRequest, promptAsync: promptGoogle } = useGoogleSignIn(
    {
      onSuccess: handleGoogleSuccess,
      onError: handleGoogleError,
    }
  );

  // If the client IDs are missing the request never arrives, leaving a silently dead button.
  useEffect(() => {
    if (!visible) {
      setAuthError(null);
      setAuthUnavailable(false);
      return;
    }
    if (googleRequest) {
      setAuthUnavailable(false);
      return;
    }
    const timer = setTimeout(
      () => setAuthUnavailable(true),
      AUTH_REQUEST_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [visible, googleRequest]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    // Spinner shows only once the token comes back (see handleGoogleSuccess);
    // the native Google account picker is in the foreground during the prompt.
    try {
      await promptGoogle();
    } catch (error) {
      // Backstop only — sign-in failures are reported through onError (handleGoogleError).
      logger.error('Google prompt failed:', error?.message || error);
      setAuthError(t('login_failed'));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Back stays live even mid-authentication: socialLogin has no timeout, so
      // blocking the exit here would trap the guest behind a hung request (SCRUM-55 review).
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.popup}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            disabled={isAuthenticating}
          >
            <CloseIcon width={24} height={24} />
          </TouchableOpacity>

          <View style={styles.header}>
            <MaskedView
              maskElement={<Text style={styles.title}>{t('modal_title')}</Text>}
            >
              <LinearGradient
                colors={['#C118F9', Colors.primary.default]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 0 }}
              >
                <Text style={[styles.title, { opacity: 0 }]}>
                  {t('modal_title')}
                </Text>
              </LinearGradient>
            </MaskedView>
            <Text style={styles.subtitle}>{t('modal_subtitle')}</Text>
          </View>

          {isAuthenticating ? (
            <ActivityIndicator
              size="large"
              color={Colors.primary.default}
              style={{ marginVertical: 20 }}
            />
          ) : (
            <View style={styles.buttonsSection}>
              <Text style={styles.signUpLabel}>
                {t('social_options_label')}
              </Text>
              <View style={styles.buttonsList}>
                {/* Disabled until the native Google client finishes configuring
                    (a frame or two) — an early tap would be a silent no-op. */}
                <RegisterButton
                  icon={GoogleIcon}
                  label={t('google_button')}
                  onPress={handleGoogleLogin}
                  disabled={!googleRequest}
                />
                {/* Apple/Facebook/X/Instagram are stubs. Wiring Apple is not a
                    one-liner: authService.loginWithApple() (auth.service.js) does
                    Apple OAuth → Firebase credential → server call internally and
                    returns the server response, bypassing socialLogin() in
                    AuthContext. It must be split into (1) get firebaseToken and
                    (2) socialLogin(firebaseToken) — i.e. a useAppleSignIn hook
                    mirroring useGoogleSignIn. Facebook is deferred by product. */}
                {Platform.OS === 'ios' && (
                  <RegisterButton
                    icon={AppleIcon}
                    label={t('apple_button')}
                    onPress={() => {}}
                  />
                )}
                <RegisterButton
                  icon={FacebookIcon}
                  label={t('facebook_button')}
                  onPress={() => {}}
                />
                <RegisterButton
                  icon={XIcon}
                  label={t('x_button')}
                  onPress={() => {}}
                />
                <RegisterButton
                  icon={InstagramIcon}
                  label={t('instagram_button')}
                  onPress={() => {}}
                />
              </View>
              {(authError || authUnavailable) && (
                <Text style={styles.errorText}>
                  {authError ?? t('auth_unavailable')}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

LazyAuthModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  popup: {
    backgroundColor: Colors.surface.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingVertical: Spacing.max,
    paddingHorizontal: Spacing['2xl'],
    gap: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 19,
  },
  header: {
    gap: Spacing.lg,
    alignItems: 'center',
  },
  title: {
    ...TextStyles.h2,
    color: Colors.primary.default,
  },
  subtitle: {
    ...TextStyles.subtitleM,
    textAlign: 'center',
  },
  buttonsSection: {
    gap: Spacing['3xl'],
  },
  signUpLabel: {
    ...TextStyles.bodyMRegular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  buttonsList: {
    gap: Spacing.lg,
  },
  errorText: {
    ...TextStyles.bodyMRegular,
    color: Colors.error.main,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
