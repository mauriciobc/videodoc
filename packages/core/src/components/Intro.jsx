import { useCurrentFrame, interpolate, AbsoluteFill, staticFile, Img } from 'remotion';
import { defaultTheme } from '../remotion/theme.js';

export const Intro = ({ title, appName, description, logo, theme = defaultTheme }) => {
  const frame = useCurrentFrame();
  const appNameOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [15, 40], [24, 0], { extrapolateRight: 'clamp' });
  const descOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at 30% 50%, ${theme.surface} 0%, ${theme.background} 70%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: `${theme.safeAreaY}px ${theme.safeAreaX}px`,
    }}>
      <div style={{ position: 'absolute', top: '10%', right: '5%', width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${theme.accent}20 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${theme.accentAlt}15 0%, transparent 70%)`, pointerEvents: 'none' }} />
      {logo ? (
        <Img src={staticFile(logo)} alt={appName ? `${appName} logo` : ''} style={{ height: 64, maxWidth: 240, objectFit: 'contain', marginBottom: 20, opacity: appNameOpacity }} />
      ) : appName && (
        <div style={{ fontFamily: theme.fontFamily, fontSize: theme.fontSizeSmall, fontWeight: theme.fontWeightBold, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 20, opacity: appNameOpacity }}>
          {appName}
        </div>
      )}
      <div style={{ fontFamily: theme.fontFamily, fontSize: 48, fontWeight: theme.fontWeightBold, color: theme.textPrimary, textAlign: 'center', lineHeight: 1.2, maxWidth: 800, opacity: titleOpacity, transform: `translateY(${titleY}px)` }}>
        {title}
      </div>
      {description && (
        <div style={{ fontFamily: theme.fontFamily, fontSize: theme.fontSize, color: theme.textSecondary, textAlign: 'center', marginTop: 24, maxWidth: 600, lineHeight: 1.7, opacity: descOpacity }}>
          {description}
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, transparent, ${theme.accent}, ${theme.accentAlt}, transparent)`, opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' }) }} />
    </AbsoluteFill>
  );
};
