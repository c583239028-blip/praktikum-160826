import PropTypes from 'prop-types';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Colors,
  Spacing,
  FontSize,
  FontWeight,
  BorderRadius,
} from '../../constants/design';

export default function BirthdayModal({ visible, onConfirm }) {
  const [date, setDate] = useState(new Date(2000, 0, 1));
  const { t } = useTranslation('birthday');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('modal_title')}</Text>

          <DateTimePicker
            value={date}
            mode="date"
            display="spinner"
            onChange={(event, selectedDate) => setDate(selectedDate || date)}
            maximumDate={new Date()}
            textColor="#fff"
          />

          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              onConfirm(date);
            }}
          >
            <Text style={styles.btnText}>{t('confirm_button')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
BirthdayModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
};
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Colors.neutral[900],
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
  },
  title: {
    color: Colors.surface.white,
    fontSize: FontSize.subtitleM,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
  pickerPlaceholder: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral[600],
    borderRadius: BorderRadius.sm,
  },
  placeholderText: { color: Colors.text.secondary },
  btn: {
    backgroundColor: Colors.primary.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing['2xl'],
  },
  btnText: {
    color: Colors.surface.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.bodyL,
  },
});
