import { I18nManager } from 'react-native';

// I18nManager.isRTL (not i18n.language) is used because it reflects the
// layout direction actually applied by i18n.js (via applyRTL + forceRTL)
// when the language was set — staying in sync with native layout, not just
// the active translation string.
export function useRTL() {
  const isRTL = I18nManager.isRTL;
  return {
    isRTL,
    // Maps to 'right' in RTL (Hebrew), 'left' in LTR (English)
    textAlign: isRTL ? 'right' : 'left',
    // Inverse alignment, useful for secondary/total text that should mirror the primary one
    textAlignReverse: isRTL ? 'left' : 'right',
    // Default row direction: 'row' in LTR, 'row-reverse' in RTL
    flexDirection: isRTL ? 'row-reverse' : 'row',
    // Inverse of the above, for rows that should NOT flip with language
    flexDirectionReverse: isRTL ? 'row' : 'row-reverse',
  };
}

export default useRTL;
