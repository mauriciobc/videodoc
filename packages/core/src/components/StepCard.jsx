import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';
import { defaultTheme } from '../remotion/theme.js';

export const StepCard = ({ title, subtitle, stepNumber, theme = defaultTheme }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 25], [20, 0], { extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${theme.surface} 0%, ${theme.surfaceAlt} 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: `${theme.safeAreaY}px ${theme.safeAreaX}px`, opacity,
    }}>
      <div style={{ width: 60, height: 4, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentAlt})`, borderRadius: 2, marginBottom: 32 }} />
      {stepNumber && (
        <div style={{ fontFamily: theme.fontFamily, fontSize: theme.fontSizeSmall, fontWeight: theme.fontWeightBold, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>
          {stepNumber}
        </div>
      )}
      <div style={{ fontFamily: theme.fontFamily, fontSize: theme.fontSizeLarge, fontWeight: theme.fontWeightBold, color: theme.textPrimary, textAlign: 'center', lineHeight: 1.3, transform: `translateY(${titleY}px)`, maxWidth: 700 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontFamily: theme.fontFamily, fontSize: theme.fontSize, color: theme.textSecondary, textAlign: 'center', marginTop: 20, opacity: subtitleOpacity, maxWidth: 600, lineHeight: 1.6 }}>
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
