// ─────────────────────────────────────────────
// HyPulse — Design System Constants
// Source: Figma "WorId Game (Shira)" — Design System page
// node-id: 6248-54457 (Colors), 6248-54723 (Typography)
// ─────────────────────────────────────────────

// ─── COLORS ──────────────────────────────────

export const Colors = {
  // Primary — Cyan
  primary: {
    dark: '#00D3F2',
    default: '#00E5FF',
    light: '#ACF4FF',
    extraLight: '#F4FDFF',
  },

  // Secondary — Purple
  secondary: {
    dark: '#8C2ED6',
    default: '#B300FF',
    light: '#DEB5FF',
    extraLight: '#F7ECFF',
  },

  // Neutrals — Gray primitives
  neutral: {
    900: '#1F293B', // Gray/1000 ✓
    600: '#63656B', // Gray/600 ✓
    500: '#848A96', // Gray/500 ✓
    300: '#C9CFDA', // Gray/300 ✓
    200: '#DEE1E8', // Gray/200 ✓
    100: '#EDF0F6', // Gray/100 ✓
  },

  // Text — resolved from Tokens → text group
  text: {
    primary: '#1F293B', // Gray/1000 ✓
    secondary: '#63656B', // Gray/600 ✓
    tertiary: '#A1A7B2', // Gray/400 ✓
  },

  // Semantic
  error: {
    dark: '#D31317', // Red/300 ✓
    main: '#E2282B', // Red/200 ✓
    light: '#FCDEDF', // Red/100 ✓
  },
  warning: {
    dark: '#E08835',
    main: '#F29A5C',
    light: '#FFD8BC',
  },
  success: {
    dark: '#257E0E',
    main: '#33A815',
    light: '#EDFFE8',
  },
  info: {
    dark: '#1C7089',
    main: '#3B91AB',
    light: '#E4EBED',
  },

  // Surface
  surface: {
    white: '#FFFFFF',
    dark: '#020917',
  },

  // Brand
  live: '#FF4757',

  liveIndicator: {
    live: '#2fb863',
    pause: '#ff4757',
  },
};

// ─── GRADIENTS ───────────────────────────────
// Use with expo-linear-gradient: <LinearGradient colors={Gradients.live} ...>

export const Gradients = {
  // LIVE button — purple → cyan (left to right)
  live: ['#8C2ED6', '#00E5FF'],

  // Softer version (press/active state)
  livePress: ['#663152', '#00D3F2'],

  // Brand wizard/share gradient — cyan → magenta → purple (3-stop)
  brand: ['#00E5FF', '#B300FF', '#8C2ED6'],
};

// ─── TYPOGRAPHY ──────────────────────────────

export const FontFamily = {
  primary: 'Rubik',
};

export const FontSize = {
  h1: 32,
  h2: 22,
  subtitleL: 20,
  subtitleM: 18,
  bodyL: 16,
  bodyM: 14,
  caption: 12,
};

export const FontWeight = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
};

export const LineHeight = {
  h1: 40,
  h2: 28,
  subtitleL: 24,
  subtitleM: 24,
  bodyL: 20,
  bodyM: 18,
  caption: 16,
};

// ─── TEXT STYLES ─────────────────────────────
// Ready-to-spread into StyleSheet.create({})
// Usage: StyleSheet.create({ title: TextStyles.h1 })

export const TextStyles = {
  h1: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.h1,
    fontWeight: FontWeight.bold,
    lineHeight: LineHeight.h1,
    color: Colors.text.primary,
  },
  h2: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    lineHeight: LineHeight.h2,
    color: Colors.text.primary,
  },
  subtitleL: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.subtitleL,
    fontWeight: FontWeight.bold,
    lineHeight: LineHeight.subtitleL,
    color: Colors.text.primary,
  },
  subtitleM: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.subtitleM,
    fontWeight: FontWeight.bold,
    lineHeight: LineHeight.subtitleM,
    color: Colors.text.primary,
  },
  bodyLRegular: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyL,
    fontWeight: FontWeight.regular,
    lineHeight: LineHeight.bodyL,
    color: Colors.text.primary,
  },
  bodyLMedium: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyL,
    fontWeight: FontWeight.medium,
    lineHeight: LineHeight.bodyL,
    color: Colors.text.primary,
  },
  bodyMRegular: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyM,
    fontWeight: FontWeight.regular,
    lineHeight: LineHeight.bodyM,
    color: Colors.text.primary,
  },
  bodyMMedium: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.bodyM,
    fontWeight: FontWeight.medium,
    lineHeight: LineHeight.bodyM,
    color: Colors.text.primary,
  },
  captionRegular: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.regular,
    lineHeight: LineHeight.caption,
    color: Colors.text.secondary,
  },
  captionMedium: {
    fontFamily: FontFamily.primary,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    lineHeight: LineHeight.caption,
    color: Colors.text.secondary,
  },
};

// ─── SPACING ─────────────────────────────────
// Source: Size Tokens → spacing (maps to Dimension scale)

export const Spacing = {
  none: 0, // dimension/00
  sm: 4, // Dimension/50
  md: 8, // dimension/100
  lg: 12, // dimension/150
  xl: 16, // dimension/200
  '2xl': 24, // Dimension/300
  '3xl': 32, // Dimension/400
  max: 64, // Dimension/500
};

// ─── BORDER RADIUS ───────────────────────────
// Source: Size Tokens → border radius (maps to Dimension scale)

export const BorderRadius = {
  none: 0, // dimension/00
  xs: 4, // Dimension/50
  sm: 8, // dimension/100
  md: 16, // dimension/200
  lg: 24, // dimension/300
  xl: 64, // dimension/500
  full: 999,
};
