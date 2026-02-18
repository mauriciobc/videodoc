// Remotion Components
export { StepCard } from './components/StepCard.jsx';
export { Caption } from './components/Caption.jsx';
export { Highlight } from './components/Highlight.jsx';
export { ScreenFrame } from './components/ScreenFrame.jsx';
export { Intro } from './components/Intro.jsx';
export { Outro } from './components/Outro.jsx';
export { ZoomIn } from './components/ZoomIn.jsx';
export { BaseComposition } from './remotion/BaseComposition.jsx';

// Theme
export { defaultTheme, mergeTheme } from './remotion/theme.js';

// Playwright Helpers
export {
  capture,
  captureFullPage,
  setupLocalStorageState,
  setupApiState,
  waitAndCapture,
  hoverAndCapture,
  resetToFreshState,
  defaultSlowMo,
} from './playwright/helpers.js';

export { createFixture } from './playwright/fixtures.js';
