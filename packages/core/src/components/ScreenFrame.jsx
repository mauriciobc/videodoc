import { Img, useVideoConfig, interpolate, useCurrentFrame } from 'remotion';
import { defaultTheme } from '../remotion/theme.js';

export const ScreenFrame = ({
  src,
  theme = defaultTheme,
  entrance = 'fade',
  entranceFrames = 20,
  scale = 1,
  chrome = 'clean',
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const opacity = entrance === 'none' ? 1
    : interpolate(frame, [0, entranceFrames], [0, 1], { extrapolateRight: 'clamp' });
  const translateY = entrance === 'slide-up'
    ? interpolate(frame, [0, entranceFrames], [30, 0], { extrapolateRight: 'clamp' }) : 0;
  const scaleAnim = entrance === 'zoom'
    ? interpolate(frame, [0, entranceFrames], [0.92, 1], { extrapolateRight: 'clamp' }) : scale;

  const browserChrome = chrome === 'browser' ? (
    <div style={{ background: '#2d2d2d', height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
      {['#ff5f57', '#febc2e', '#28c840'].map((color, i) => (
        <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
      ))}
      <div style={{ flex: 1, background: '#3d3d3d', borderRadius: 4, height: 20, marginLeft: 8 }} />
    </div>
  ) : null;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.frameBackground }}>
      <div style={{
        borderRadius: theme.frameBorderRadius,
        boxShadow: theme.frameShadow,
        overflow: 'hidden',
        opacity,
        transform: `translateY(${translateY}px) scale(${scaleAnim})`,
        maxWidth: width * 0.9,
        maxHeight: height * 0.9,
      }}>
        {browserChrome}
        <Img src={src} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
      </div>
    </div>
  );
};
