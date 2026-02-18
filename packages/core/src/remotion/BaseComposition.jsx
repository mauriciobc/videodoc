import { AbsoluteFill, Sequence } from 'remotion';
import { Intro } from '../components/Intro.jsx';
import { defaultTheme } from './theme.js';

export const BaseComposition = ({
  title,
  appName,
  description,
  children,
  introDuration = 90,
  theme = defaultTheme,
}) => (
  <AbsoluteFill style={{ background: theme.background }}>
    <Sequence from={0} durationInFrames={introDuration}>
      <Intro title={title} appName={appName} description={description} theme={theme} />
    </Sequence>
    <Sequence from={introDuration}>
      {children}
    </Sequence>
  </AbsoluteFill>
);
