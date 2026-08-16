// packages/client/src/services/animationAssets.service.js

const ANIMATION_FILE_SUFFIX = '_question_large.mp4';

/**
 * בונה את כתובת ה-URL לקובץ אנימציית win/lose בשרת.
 * מבודד את הידע על מבנה הנתיב/סיומת הקובץ משכבת ה-UI,
 * כדי ששינוי עתידי במיקום הקבצים (ר' ביקורת 4.1) לא ידרוש
 * לגעת בקומפוננטת התצוגה.
 */
export function getAnimationUri(type) {
  return `${process.env.EXPO_PUBLIC_API_URL}/assets/animations/${type}${ANIMATION_FILE_SUFFIX}`;
}
