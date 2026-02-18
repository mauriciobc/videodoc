export const defaultTheme = {
  // Typography
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  fontSize: 22,
  fontSizeSmall: 16,
  fontSizeLarge: 32,
  fontWeightNormal: 400,
  fontWeightBold: 700,

  // Colors
  background: '#0f0f0f',
  surface: '#1a1a2e',
  surfaceAlt: '#16213e',
  textPrimary: '#ffffff',
  textSecondary: '#a0aec0',
  accent: '#6366f1',
  accentAlt: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',

  // Caption
  captionBg: 'rgba(0, 0, 0, 0.75)',
  captionColor: '#ffffff',
  captionPaddingX: 28,
  captionPaddingY: 12,
  captionBorderRadius: 8,
  captionMaxWidth: '80%',

  // Highlight
  highlightColor: '#f59e0b',
  highlightBorderWidth: 3,
  highlightBorderRadius: 6,
  highlightGlowOpacity: 0.3,

  // Step Card
  stepCardBg: '#1a1a2e',
  stepCardAccent: '#6366f1',
  stepCardBorderRadius: 16,

  // Screen Frame
  frameBackground: '#111111',
  frameBorderRadius: 12,
  frameShadow: '0 25px 60px rgba(0,0,0,0.6)',
  framePadding: 0,

  // Layout
  safeAreaX: 80,
  safeAreaY: 60,
};

export const mergeTheme = (overrides = {}) => ({
  ...defaultTheme,
  ...overrides,
});
