import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer } from 'expo-audio';

export function useAudioPlayback() {
  const playerRef = useRef(null);
  const [playingUri, setPlayingUri] = useState(null);

  const stop = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch {
      }
      playerRef.current = null;
    }
    setPlayingUri(null);
  }, []);

  const play = useCallback(
    (uri) => {
      if (!uri) return;
      const wasPlaying = playingUri === uri;
      stop();
      if (wasPlaying) return;
      try {
        const player = createAudioPlayer(uri, { updateInterval: 400 });
        playerRef.current = player;
        setPlayingUri(uri);
        player.addListener('playbackStatusUpdate', (status) => {
          if (!status) return;
          if (!status.playing && status.isLoaded && status.duration > 0 && status.currentTime >= status.duration - 0.08) {
            stop();
          }
        });
        player.play();
      } catch {
        setPlayingUri(null);
      }
    },
    [playingUri, stop]
  );

  useEffect(() => () => stop(), [stop]);

  return { play, stop, playingUri };
}
