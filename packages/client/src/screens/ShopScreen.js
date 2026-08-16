import React, { useEffect, useState, useCallback } from 'react';
import { logger } from '@worldplay/shared';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { apiFetch } from '../services/apiHelpers';
import { API_BASE_URL } from '../services/apiConfig';
import PropTypes from 'prop-types';
import { useStripe } from '@stripe/stripe-react-native';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { updateBalances } from '../store/slices/walletSlice';
import { userService } from '../services/userService';
import Screen from '../components/Screen';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontWeight,
} from '../../constants/design';
import { useScale } from '../hooks/useScale';
import { useRTL } from '../hooks/useRTL';

// ─── PackageCard ─────────────────────────────────────────────────────────────
// Defined outside ShopScreen so it is not re-created on every render.
const PackageCard = ({
  title,
  price,
  onPress,
  disabled,
  popular,
  popularLabel,
  bonusLabel,
}) => {
  const { scale } = useScale();
  return (
    <TouchableOpacity
      style={[styles.packageCard, popular && styles.popular]}
      onPress={onPress}
      disabled={disabled}
    >
      {popular && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{popularLabel}</Text>
        </View>
      )}
      <Text style={styles.packageTitle}>{title}</Text>
      <Text style={[styles.packagePrice, { fontSize: scale(FontSize.h2) }]}>
        {price}
      </Text>
      {popular && <Text style={styles.bonusText}>{bonusLabel}</Text>}
    </TouchableOpacity>
  );
};

PackageCard.propTypes = {
  title: PropTypes.string.isRequired,
  price: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  popular: PropTypes.bool,
  popularLabel: PropTypes.string,
  bonusLabel: PropTypes.string,
};

// ─── ShopScreen ──────────────────────────────────────────────────────────────
const ShopScreen = ({ userId, onLogout }) => {
  const { t } = useTranslation('shop');
  const { textAlign } = useRTL();
  const dispatch = useDispatch();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { scale } = useScale();

  const [fetchingBalance, setFetchingBalance] = useState(true);
  const [loading, setLoading] = useState(false);

  // Redux sync — wallet and score are read here and auto-updated via socket middleware
  const coins = useSelector((state) => state.wallet.walletBalance || 0);
  const scores = useSelector((state) => state.wallet.scoresByGame || {});

  // ========================================
  // Fetch profile and sync balances into Redux
  // ========================================
  const fetchAndSyncBalance = useCallback(async () => {
    try {
      const data = await userService.getMe();
      dispatch(
        updateBalances({
          walletCoins: data.walletCoins || data.walletBalance,
          scoresByGame: data.scoresByGame || {},
        })
      );
    } catch (e) {
      logger.error('Fetch balance error:', e);
    }
  }, [dispatch]);

  useEffect(() => {
    const initializeScreen = async () => {
      setFetchingBalance(true);
      await fetchAndSyncBalance();
      setFetchingBalance(false);
    };
    initializeScreen();
  }, [userId, fetchAndSyncBalance]);

  // ── Payment ─────────────────────────────────────────────────────────────────
  const buyPackage = async (amount) => {
    setLoading(true);
    try {
      const data = await apiFetch(`${API_BASE_URL}/api/payments/create-sheet`, {
        method: 'POST',
        body: JSON.stringify({ userId, coins: amount }),
      });
      const { paymentIntent, ephemeralKey, customer } = data;

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'WorldPlay',
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        allowsDelayedPaymentMethods: false,
        appearance: { colors: { primary: '#ffa502' } },
      });

      if (initError) throw initError;

      const { error: paymentError } = await presentPaymentSheet();

      if (!paymentError) {
        Alert.alert(t('payment_success_title'), t('payment_success_message'));
        setTimeout(fetchAndSyncBalance, 3000);
      }
      // user cancelled or payment failed — no action needed
    } catch (error) {
      logger.error('Payment error:', error);
      Alert.alert(t('payment_error_title'), error.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Debug helper ─────────────────────────────────────────────────────────────
  const triggerTestAnswer = async () => {
    try {
      const data = await apiFetch(`${API_BASE_URL}/api/user-answers/submit`, {
        method: 'POST',
        body: JSON.stringify({
          questionId: 'c5d5074e-395b-404a-8c7d-0eef8c24f694',
          selectedOptionId: '1910647f-5d69-4187-a376-5ba35c1da772',
          wager: 10,
        }),
      });
      if (data.answer) {
        // Balance is auto-updated via socket middleware; fetchAndSyncBalance is a fallback
        fetchAndSyncBalance();
      }
    } catch (err) {
      Alert.alert(t('test_sync_error_title'), err.message);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (fetchingBalance) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator size="large" color={Colors.warning.main} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </Screen>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <Screen style={styles.container}>
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>{t('common:sign_out_button')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('title')}</Text>

      <View style={styles.statsContainer}>
        <Text style={[styles.balance, { textAlign }]}>
          {t('balance_label', { amount: Number(coins || 0).toFixed(2) })}
        </Text>
        <Text style={[styles.scoreText, { textAlign }]}>
          {t('active_score_label', {
            amount: Number(Object.values(scores)[0] || 0).toFixed(2),
          })}
        </Text>
      </View>

      <TouchableOpacity style={styles.testButton} onPress={triggerTestAnswer}>
        <Text style={styles.testButtonText}>{t('test_sync_button')}</Text>
      </TouchableOpacity>

      <View style={styles.packageContainer}>
        <PackageCard
          title={t('package_10_title')}
          price="₪10"
          onPress={() => buyPackage(10)}
          disabled={loading}
        />
        <PackageCard
          title={t('package_50_title')}
          price="₪50"
          popular
          popularLabel={t('most_popular_badge')}
          bonusLabel={t('first_purchase_bonus')}
          onPress={() => buyPackage(50)}
          disabled={loading}
        />
        <PackageCard
          title={t('package_100_title')}
          price="₪100"
          onPress={() => buyPackage(100)}
          disabled={loading}
        />
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.error.main} />
          <Text style={styles.loadingText}>{t('processing_payment')}</Text>
        </View>
      )}
    </Screen>
  );
};

ShopScreen.propTypes = {
  userId: PropTypes.string.isRequired,
  onLogout: PropTypes.func.isRequired,
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  title: {
    textAlign: 'center',
    color: Colors.text.primary,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
  },
  statsContainer: { marginBottom: Spacing['2xl'] },
  balance: {
    color: Colors.warning.main,
    textAlign: 'center',
    fontWeight: FontWeight.bold,
  },
  scoreText: {
    fontSize: FontSize.bodyL,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  logoutBtn: {
    position: 'absolute',
    right: Spacing['2xl'],
    backgroundColor: Colors.error.main,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  logoutText: { color: Colors.surface.white, fontWeight: FontWeight.bold },
  loadingText: { color: Colors.text.primary, marginTop: Spacing.lg },
  comingSoonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  comingSoonText: {
    fontSize: FontSize.h2,
    color: Colors.text.secondary,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
});

export default ShopScreen;
