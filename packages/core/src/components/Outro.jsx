import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';
import { defaultTheme } from '../remotion/theme.js';

export const Outro = ({ message = "You're all set!", cta, url, theme = defaultTheme }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const checkScale = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: 'clamp', easing: (t) => 1 - Math.pow(1 - t, 3) });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${theme.surface} 0%, ${theme.background} 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: `${theme.safeAreaY}px ${theme.safeAreaX}px`, opacity,
    }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: `${theme.success}20`, border: `3px solid ${theme.success}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, transform: `scale(${checkScale})`, fontSize: 36 }}>
        ✓
      </div>
      <div style={{ fontFamily: theme.fontFamily, fontSize: theme.fontSizeLarge, fontWeight: theme.fontWeightBold, color: theme.textPrimary, textAlign: 'center', marginBottom: 16 }}>
        {message}
      </div>
      {cta && (
        <div style={{ fontFamily: theme.fontFamily, fontSize: theme.fontSize, color: theme.textSecondary, textAlign: 'center', opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' }) }}>
          {cta}
        </div>
      )}
      {url && (
        <div style={{ fontFamily: theme.fontFamily, fontSize: theme.fontSizeSmall, color: theme.accent, marginTop: 12, opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' }), letterSpacing: '0.05em' }}>
          {url}
        </div>
      )}
    </AbsoluteFill>
  );
};
