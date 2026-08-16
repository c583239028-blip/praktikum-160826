import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Colors, Spacing, BorderRadius, TextStyles } from '@/constants/design';
import { RegisterButton } from './RegisterButton';
import CloseIcon from '@/assets/icons/close.svg';
import GoogleIcon from '@/assets/icons/google.svg';
import AppleIcon from '@/assets/icons/apple.svg';
import FacebookIcon from '@/assets/icons/facebook.svg';
import XIcon from '@/assets/icons/x.svg';
import InstagramIcon from '@/assets/icons/instagram.svg';
import PropTypes from 'prop-types';
import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function LazyAuthModal({ visible, onClose }) {
  const { t } = useTranslation('auth');

  const { socialLogin } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Google ID token -> register/login on our server -> close the modal.
  // TODO (T50 — unblock after Netfree/Google OAuth is fixed):
  // Race condition: calling onClose() here clears pendingActionRef in useAuthGuard
  // before its useEffect fires, so the deferred action (e.g. a bet) is lost.
  // Fix: remove the explicit onClose() call — useAuthGuard's useEffect already
  // closes the modal and executes the pending action when isGuest flips to false.
  const handleGoogleSuccess = useCallback(
    async (firebaseToken) => {
      console.log('🟢 [T50] Firebase token התקבל, שולח לשרת (socialLogin)...');
      try {
        setIsAuthenticating(true);
        await socialLogin(firebaseToken);
        console.log('🎉 [T50] רישום/התחברות בשרת הצליחו — סוגר את המודל.');
        onClose();
      } catch (error) {
        console.error('❌ [T50] שגיאת רישום בשרת:', error?.message || error);
        setAuthError(t('login_failed'));
      } finally {
        setIsAuthenticating(false);
      }
    },
    [socialLogin, onClose, t]
  );

  const handleGoogleError = useCallback(
    (err) => {
      console.error('❌ [T50] שגיאת התחברות Google:', err?.message || err);
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

  const handleSocialLogin = async (provider) => {
    setAuthError(null);
    if (provider === 'Google') {
      console.log('👆 [T50] לחיצה על Continue with Google — פותח התחברות...');
      // Spinner is shown only once the token comes back (see handleGoogleSuccess);
      // the browser is in the foreground during the prompt itself.
      await promptGoogle();
      console.log('🔁 [T50] חזרנו מהדפדפן (promptAsync הסתיים).');
      return;
    }
    // TODO (T50 — Apple, unblock after Netfree/Google is fixed and flow is verified):
    // Apple (T39): authService.loginWithApple() is implemented in auth.service.js.
    // To wire it here using the same pattern as Google, split loginWithApple into
    // two steps: (1) Apple OAuth → Firebase credential → firebaseToken, then
    // (2) call socialLogin(firebaseToken). Currently loginWithApple() does both
    // steps internally and returns the server response, which bypasses socialLogin
    // in AuthContext. Refactor or create a useAppleSignIn hook analogous to
    // useGoogleSignIn. iOS only (Platform.OS === 'ios' guard already in place).
    //
    // TODO (T50 — Facebook, deferred to later sprint per product decision):
    // Facebook login is explicitly deferred. No implementation needed now.
    //
    // X / Instagram: not in original ticket scope, no implementation planned.
    console.log(`🚫 [T50] ${provider} עדיין לא ממומש.`);
    setAuthError(t('login_failed'));
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
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
                <RegisterButton
                  icon={GoogleIcon}
                  label={t('google_button')}
                  onPress={() => handleSocialLogin('Google')}
                />
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
              {authError && <Text style={styles.errorText}>{authError}</Text>}
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
