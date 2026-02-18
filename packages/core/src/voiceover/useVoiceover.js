/**
 * useVoiceover.js
 *
 * Remotion hook that loads a voiceover audio file and sync manifest
 * for the current composition, and returns a pre-configured <Audio> element.
 *
 * Convention: audio files live in public/audio/<CompositionId>-voiceover.mp3
 * and sync manifests at public/audio/<CompositionId>-voiceover.sync.json
 *
 * The hook probes the audio URL with a HEAD request before rendering <Audio>.
 * If the file is missing it renders nothing — so the composition works both
 * with and without TTS credentials being set.
 *
 * Usage in a composition:
 *
 *   import { useVoiceover } from '@videodoc/core/voiceover';
 *
 *   export const OnboardingJourney = () => {
 *     const { VoiceoverAudio } = useVoiceover();
 *     return (
 *       <AbsoluteFill>
 *         <VoiceoverAudio />
 *         ...
 *       </AbsoluteFill>
 *     );
 *   };
 *
 * Or with an explicit file name:
 *   const { VoiceoverAudio } = useVoiceover({ file: 'my-custom-voiceover.mp3' });
 */

import { useState, useEffect, useCallback } from 'react';
import { useVideoConfig, staticFile, Audio, delayRender, continueRender } from 'remotion';

/**
 * @param {object} options
 * @param {string}  [options.file]      - Override audio filename (default: <CompositionId>-voiceover.mp3)
 * @param {string}  [options.audioDir]  - Override audio directory (default: 'audio')
 * @param {number}  [options.volume]    - Playback volume 0–1 (default: 1)
 * @param {number}  [options.startFrom] - Start playback from this frame offset (default: 0)
 * @param {boolean} [options.muted]     - Mute the audio (useful during development)
 * @returns {{ VoiceoverAudio: () => import('react').ReactNode, isReady: boolean, src: string, syncData: object | null }}
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
  const audioPath = `${audioDir}/${resolvedFile}`;
  const src = staticFile(audioPath);

  // isReady: true  → audio file exists, render <Audio>
  // isReady: false → still checking
  // isReady: null  → file not found, skip audio
  const [isReady, setIsReady] = useState(false);
  const [syncData, setSyncData] = useState(null);

  useEffect(() => {
    // Use delayRender so Remotion waits for the probe before capturing frames.
    const handle = delayRender(`Probing voiceover: ${src}`);

    const probe = async () => {
      try {
        const res = await fetch(src, { method: 'HEAD' });
        setIsReady(res.ok ? true : null);
      } catch {
        setIsReady(null);
      } finally {
        continueRender(handle);
      }
    };

    probe();
  }, [src]);

  useEffect(() => {
    if (!isReady) return;
    const syncUrl = staticFile(audioPath.replace(/\.[^/]*$/, '') + '.sync.json');
    fetch(syncUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then(setSyncData)
      .catch(() => setSyncData(null));
  }, [isReady, audioPath]);

  const VoiceoverAudio = useCallback(() => {
    if (!isReady || muted) return null;
    return <Audio src={src} volume={volume} startFrom={startFrom} />;
  }, [isReady, muted, src, volume, startFrom]);

  return { VoiceoverAudio, isReady, src, syncData };
}
