import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import BackSvg from '../../../../assets/icons/back.svg';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontWeight,
  LineHeight,
} from '../../../../constants/design';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scaleW = SCREEN_WIDTH / 375;
const scaleH = SCREEN_HEIGHT / 812;

export function QuestionsScreenHeader({ title, onBack }) {
  const { t } = useTranslation('question');

  return (
    <SafeAreaView>
      <View style={styles.nqHeader}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BackSvg width={24} height={24} color={Colors.text.primary} />
        </TouchableOpacity>

        <Text style={styles.nqTitle}>{title}</Text>

        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>{t('common.live')}</Text>
          <View style={styles.liveDot} />
        </View>
      </View>
    </SafeAreaView>
  );
}

QuestionsScreenHeader.propTypes = {
  title: PropTypes.string.isRequired,
  onBack: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  nqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl * scaleW, // 16
    height: 65 * scaleH, // no matching design token for fixed header height - verify with designer
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
    backgroundColor: Colors.surface.white,
  },
  nqTitle: {
    fontFamily: 'Rubik', // was 'Poppins' - not loaded in this project, fixed per font policy
    fontSize: FontSize.subtitleM * scaleW, // 18
    fontWeight: FontWeight.bold,
    lineHeight: LineHeight.subtitleM * scaleW, // 24
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6 * scaleW, // no exact design token (between sm=4 and md=8) - verify with designer
    paddingVertical: 6 * scaleH, // no exact design token - verify with designer
    paddingHorizontal: 10 * scaleW, // no exact design token (between md=8 and lg=12) - verify with designer
    borderRadius: BorderRadius.full, // pill shape, same visual result as 9999
    backgroundColor: Colors.neutral[100],
  },
  liveBadgeText: {
    fontFamily: 'Rubik', // was 'Heebo' - not loaded in this project, fixed per font policy
    fontSize: FontSize.caption * scaleW, // 12
    fontWeight: FontWeight.semiBold,
    color: Colors.text.primary,
  },
  liveDot: {
    width: Spacing.md * scaleW, // 8
    height: Spacing.md * scaleW, // 8
    borderRadius: BorderRadius.xs * scaleW, // 4
    backgroundColor: Colors.live,
  },
});
