'use client';

import { useEffect, useRef } from 'react';

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const manuallyPaused = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.22;

    const publishState = () => {
      window.dispatchEvent(new CustomEvent('asps-background-music-state', { detail: !audio.paused }));
    };
    const startAfterInteraction = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.music-toggle')) return;
      if (manuallyPaused.current || !audio.paused) return;
      audio.play().catch(() => publishState());
    };
    const togglePlayback = () => {
      if (audio.paused) {
        manuallyPaused.current = false;
        audio.play().catch(() => publishState());
      } else {
        manuallyPaused.current = true;
        audio.pause();
      }
    };
    const reportState = () => publishState();

    audio.addEventListener('play', reportState);
    audio.addEventListener('pause', reportState);
    window.addEventListener('pointerdown', startAfterInteraction);
    window.addEventListener('keydown', startAfterInteraction);
    window.addEventListener('asps-toggle-background-music', togglePlayback);
    window.addEventListener('asps-background-music-state-request', publishState);

    audio.play().catch(() => publishState());

    return () => {
      audio.removeEventListener('play', reportState);
      audio.removeEventListener('pause', reportState);
      window.removeEventListener('pointerdown', startAfterInteraction);
      window.removeEventListener('keydown', startAfterInteraction);
      window.removeEventListener('asps-toggle-background-music', togglePlayback);
      window.removeEventListener('asps-background-music-state-request', publishState);
    };
  }, []);

  return <audio ref={audioRef} src="/pacesic.mp3" loop preload="auto" />;
}
