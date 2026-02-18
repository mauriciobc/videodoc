import { useCurrentFrame, interpolate } from 'remotion';
import { defaultTheme } from '../remotion/theme.js';

export const Highlight = ({
  x, y, width, height,
  theme = defaultTheme,
  padding = 4,
  animation = 'pulse',
}) => {
  const frame = useCurrentFrame();

  const pulseOpacity = animation === 'pulse' ? 0.6 + 0.4 * Math.sin(frame * 0.2) : 1;
  const fadeOpacity = animation === 'fade'
    ? interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }) : 1;
  const drawScale = animation === 'draw'
    ? interpolate(frame, [0, 20], [0.7, 1], { extrapolateRight: 'clamp' }) : 1;
  const opacity = animation === 'pulse' ? pulseOpacity : fadeOpacity;

  return (
    <div style={{
      position: 'absolute',
      left: x - padding,
      top: y - padding,
      width: width + padding * 2,
      height: height + padding * 2,
      border: `${theme.highlightBorderWidth}px solid ${theme.highlightColor}`,
      borderRadius: theme.highlightBorderRadius,
      boxShadow: `0 0 0 4px ${theme.highlightColor}${Math.round(theme.highlightGlowOpacity * 255).toString(16).padStart(2, '0')}`,
      opacity,
      transform: `scale(${drawScale})`,
      transformOrigin: 'center center',
      pointerEvents: 'none',
      zIndex: 20,
    }} />
  );
};
