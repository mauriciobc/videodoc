import { useCurrentFrame, interpolate, AbsoluteFill, Img } from 'remotion';
import { defaultTheme } from '../remotion/theme.js';

export const ZoomIn = ({
  src, focusX = 0.5, focusY = 0.5, zoomLevel = 2, zoomFrames = 30, theme = defaultTheme,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, zoomFrames], [1, zoomLevel], {
    extrapolateRight: 'clamp',
    easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  });
  const translateX = (0.5 - focusX) * 100 * (scale - 1);
  const translateY = (0.5 - focusY) * 100 * (scale - 1);

  return (
    <AbsoluteFill style={{ background: theme.frameBackground, overflow: 'hidden' }}>
      <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`, transformOrigin: 'center center' }} />
    </AbsoluteFill>
  );
};
