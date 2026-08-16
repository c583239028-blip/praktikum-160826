import { useWindowDimensions, PixelRatio } from 'react-native';

// Figma base frame width (iPhone 14/15). All design sizes are authored against this.
// See docs/responsive-ui-guidelines.md.
const GUIDELINE_BASE_WIDTH = 390;

/**
 * Responsive sizing helpers that adapt a px value (authored on the 390-wide Figma base)
 * to the current screen width. Recomputes on rotation/resize (useWindowDimensions).
 *
 *   const { scale, moderateScale } = useScale();
 *   fontSize: scale(FontSize.h1)          // linear — for prominent typography / large spacings
 *   padding:  moderateScale(Spacing.lg)   // dampened — avoids blow-up on tablets/large phones
 *
 * Keep hairlines, borders, and already-token spacings that look fine fixed — don't scale everything.
 */
export function useScale() {
  const { width } = useWindowDimensions();
  const ratio = width / GUIDELINE_BASE_WIDTH;

  const scale = (size) =>
    Math.round(PixelRatio.roundToNearestPixel(size * ratio));

  // factor (0..1): 0 = no scaling, 1 = full linear scaling. 0.5 is a good default.
  const moderateScale = (size, factor = 0.5) =>
    Math.round(
      PixelRatio.roundToNearestPixel(size + (size * ratio - size) * factor)
    );

  return { scale, moderateScale };
}

export default useScale;
