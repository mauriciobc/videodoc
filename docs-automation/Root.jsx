import { Composition, registerRoot } from 'remotion';
import { AuthFlow } from './compositions/AuthFlow.jsx';
import { VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from './video-config.js';

const DURATION_SEC = 15;

const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="AuthFlow"
        component={AuthFlow}
        durationInFrames={DURATION_SEC * VIDEO_FPS}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{ appName: 'Mealtime' }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
