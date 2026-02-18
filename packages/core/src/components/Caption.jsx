import { useCurrentFrame, interpolate } from 'remotion';
import { defaultTheme } from '../remotion/theme.js';

export const Caption = ({
  text,
  position = 'bottom',
  theme = defaultTheme,
  fadeInFrames = 12,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateRight: 'clamp' });
  const translateY = interpolate(frame, [0, fadeInFrames], [10, 0], { extrapolateRight: 'clamp' });

  const positionStyles = {
    bottom: { bottom: theme.safeAreaY },
    top: { top: theme.safeAreaY },
    center: { top: '50%' },
  };

  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      transform: `translateX(-50%) translateY(${translateY}px)`,
      ...positionStyles[position],
      background: theme.captionBg,
      color: theme.captionColor,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fontWeight: theme.fontWeightNormal,
      lineHeight: 1.5,
      padding: `${theme.captionPaddingY}px ${theme.captionPaddingX}px`,
      borderRadius: theme.captionBorderRadius,
      maxWidth: theme.captionMaxWidth,
      textAlign: 'center',
      opacity,
      backdropFilter: 'blur(8px)',
      zIndex: 10,
      boxSizing: 'border-box',
    }}>
      {text}
    </div>
  );
};
