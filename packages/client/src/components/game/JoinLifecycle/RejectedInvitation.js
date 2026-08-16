import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import AlertTriangleSvg from '../../../../assets/icons/alret-triangel.svg';
import CloseSvg from '../../../../assets/icons/close.svg';
import { Spacing } from '../../../../constants/design';

const AUTO_DISMISS_MS = 30000;

export function RejectedInvitation({ role, onClose }) {
  const { t } = useTranslation('invitation');
  const [visible, setVisible] = useState(true);

  // ── סגירה אוטומטית אחרי 30 שניות ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [visible]);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <AlertTriangleSvg width={24} height={24} color="#FFFFFF" />
      <Text style={styles.text}>{t(`rejectedMessage.${role}`)}</Text>
      <TouchableOpacity
        onPress={handleClose}
        style={styles.closeContainer}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <CloseSvg width={16} height={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

RejectedInvitation.propTypes = {
  role: PropTypes.oneOf(['player', 'moderator']).isRequired,
  onClose: PropTypes.func,
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  text: {
    fontFamily: 'Rubik',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: '#FFFFFF',
  },
  closeContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
