/**
 * Converts a HEX color string to an RGBA color string with a given alpha.
 * Keeps gradient definitions tied to design tokens instead of hardcoded RGB values.
 *
 * @param {string} hex - Hex color string, e.g. '#1F293B'.
 * @param {number} alpha - Opacity value between 0 and 1 (clamped).
 * @returns {string} RGBA color string, e.g. 'rgba(31, 41, 59, 0.9)'.
 */
export const hexToRgba = (hex, alpha = 1) => {
  const sanitizedHex = hex.replace('#', '');

  if (sanitizedHex.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  const r = parseInt(sanitizedHex.substring(0, 2), 16);
  const g = parseInt(sanitizedHex.substring(2, 4), 16);
  const b = parseInt(sanitizedHex.substring(4, 6), 16);

  const clampedAlpha = Math.min(1, Math.max(0, alpha));

  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
};
