/**
 * useVoiceover.js
 *
 * Remotion hook that loads a voiceover audio file and sync manifest
 * for the current composition, and returns a pre-configured <Audio> element.
 *
 * Convention: audio files live in public/audio/<CompositionId>-voiceover.mp3
 * and sync manifests at public/audio/<CompositionId>-voiceover.sync.json
 *
 * Usage in a composition:
 *
 *   import { useVoiceover } from '@videodoc/core';
 *
 *   export const OnboardingJourney = () => {
 *     const { VoiceoverAudio, isReady } = useVoiceover();
 *     return (
 *       <AbsoluteFill>
 *         {isReady && <VoiceoverAudio />}
 *         ...
 *       </AbsoluteFill>
 *     );
 *   };
 *
 * Or with an explicit file name:
 *   const { VoiceoverAudio } = useVoiceover({ file: 'my-custom-voiceover.mp3' });
 */

import { useVideoConfig, staticFile, Audio } from 'remotion';

/**
 * @param {object} options
 * @param {string} [options.file]         - Override audio filename (default: <CompositionId>-voiceover.mp3)
 * @param {string} [options.audioDir]     - Override audio directory (default: 'audio')
 * @param {number} [options.volume]       - Playback volume 0–1 (default: 1)
 * @param {number} [options.startFrom]    - Start playback from this frame offset (default: 0)
 * @param {boolean} [options.muted]       - Mute the audio (useful during composition development)
 */
export function useVoiceover({
  file,
  audioDir = 'audio',
  volume = 1,
  startFrom = 0,
  muted = false,
} = {}) {
  const { id: compositionId } = useVideoConfig();

  const resolvedFile = file ?? `${compositionId}-voiceover.mp3`;
  const audioPath    = `${audioDir}/${resolvedFile}`;

  let src;
  let isReady = false;

  try {
    src = staticFile(audioPath);
    isReady = true;
  } catch {
    // File not found — silently skip audio in preview
    isReady = false;
  }

  /**
   * Drop-in <Audio> component pre-wired with the resolved src and options.
   * Render this at the top level of your composition (not inside a Sequence).
   */
  const VoiceoverAudio = () => {
    if (!isReady || muted) return null;
    return (
      <Audio
        src={src}
        volume={volume}
        startFrom={startFrom}
      />
    );
  };

  return {
    VoiceoverAudio,
    isReady,
    src,
    audioPath,
  };
}
