import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth.service';
import { connectAppSocket } from '../services/socket.service';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontWeight,
} from '../../constants/design';
import { useScale } from '../hooks/useScale';
import { useRTL } from '../hooks/useRTL';

const LoginScreen = ({ onLoginSuccess }) => {
  const { t } = useTranslation('login');
  const { textAlign } = useRTL();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('error_title'), t('fill_all_fields_error'));
      return;
    }

    setLoading(true);
    try {
      const data = await authService.login(email, password);
      await connectAppSocket();
      onLoginSuccess({
        id: data.user.id,
        email: data.user.email,
        username: data.user.username || data.user.email,
      });
    } catch (error) {
      Alert.alert(
        t('login_failed_title'),
        error.message || t('login_failed_default_message')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    try {
      const data = await authService.loginWithApple();
      await connectAppSocket();
      onLoginSuccess({
        id: data.user.id,
        email: data.user.email,
        username: data.user.username || data.user.email,
      });
    } catch (error) {
      if (error.code === 'USER_CANCELED') return;
      Alert.alert(t('sign_in_error_title'), error.message, [
        { text: t('try_again_button') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // TODO(SCRUM-117): implement Facebook login once Meta App Review is approved.
  const handleFacebookLogin = async () => {};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('app_title')}</Text>
      <Text style={styles.subtitle}>{t('sign_in_subtitle')}</Text>

      <TextInput
        style={[styles.input, { textAlign }]}
        placeholder={t('email_placeholder')}
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder={t('password_placeholder')}
        placeholderTextColor={Colors.text.tertiary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.surface.white} />
        ) : (
          <Text style={styles.loginText}>{t('sign_in_button')}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.separatorContainer}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>{t('or_separator')}</Text>
        <View style={styles.separatorLine} />
      </View>

      <View style={styles.socialButtonsContainer}>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[
              styles.socialBtn,
              styles.appleBtn,
              loading && styles.loginBtnDisabled,
            ]}
            onPress={handleAppleLogin}
            disabled={loading}
          >
            <Text style={styles.appleText}> {t('apple_button')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.socialBtn,
            styles.facebookBtn,
            loading && styles.loginBtnDisabled,
          ]}
          onPress={handleFacebookLogin}
          disabled={true}
        >
          <Text style={styles.facebookText}>f {t('facebook_button')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

LoginScreen.propTypes = {
  onLoginSuccess: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  title: {
    textAlign: 'center',
    color: Colors.warning.main,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
  },
  subtitle: {
    textAlign: 'center',
    color: Colors.text.primary,
    marginBottom: Spacing['3xl'],
  },
  input: {
    backgroundColor: Colors.neutral[100],
    color: Colors.text.primary,
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xl,
    textAlign: 'right',
  },
  loginBtn: {
    backgroundColor: Colors.warning.main,
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginText: {
    color: Colors.neutral[900],
    fontWeight: FontWeight.bold,
    fontSize: FontSize.subtitleM,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing['2xl'],
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.neutral[300],
  },
  separatorText: {
    color: Colors.text.tertiary,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.bodyM,
  },
  socialButtonsContainer: {
    gap: Spacing.lg,
  },
  socialBtn: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleBtn: {
    backgroundColor: Colors.surface.white,
  },
  appleText: {
    color: Colors.neutral[900],
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.bodyL,
  },
  facebookBtn: {
    backgroundColor: '#1877F2',
  },
  facebookText: {
    color: Colors.surface.white,
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.bodyL,
  },
});

export default LoginScreen;
