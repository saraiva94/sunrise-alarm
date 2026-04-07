import { useState, useRef, useCallback } from 'react';
import Sound from 'react-native-sound';

// Enable playback in silence mode (iOS)
Sound.setCategory('Playback');

export function useAudioPreview() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Sound | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stop = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.release();
      soundRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const play = useCallback((id: string, url: string, duration: number = 3000, isLocal: boolean = false) => {
    // Stop any currently playing audio
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.release();
      soundRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If clicking the same sound that's playing, just stop it
    if (playingId === id) {
      setPlayingId(null);
      return;
    }

    // Play new audio — local files use MAIN_BUNDLE, remote files use empty string
    const basePath = isLocal ? Sound.MAIN_BUNDLE : '';
    const sound = new Sound(url, basePath, (error) => {
      if (error) {
        setPlayingId(null);
        return;
      }

      soundRef.current = sound;
      setPlayingId(id);

      sound.play((success) => {
        // Handle when audio ends naturally
        if (success) {
          setPlayingId(null);
          soundRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      });

      // Auto-stop after duration
      timeoutRef.current = setTimeout(() => {
        sound.stop();
        sound.release();
        setPlayingId(null);
        soundRef.current = null;
      }, duration);
    });
  }, [playingId]);

  const isPlaying = useCallback((id: string) => playingId === id, [playingId]);

  return { play, stop, isPlaying, playingId };
}
