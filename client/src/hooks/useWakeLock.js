import { useState, useEffect, useRef, useCallback } from 'react';

// Minimal valid silent MP4 (1x1 black pixel, 1 frame) used only as a fallback if navigator.wakeLock is blocked on iOS
const SILENT_VIDEO_DATA_URI =
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAu1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjc5NSA2YThhOWI2IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAABrZWI1//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjc5NSA2YThhOWI2IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAABrZWI1';

/**
 * Keeps the screen awake during active workouts.
 * Uses navigator.wakeLock with automatic re-acquisition on visibility/focus/tap,
 * plus a silent inline video fallback if the browser blocks Wake Lock.
 */
export function useWakeLock() {
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef(null);
  const videoRef = useRef(null);
  const isMountedRef = useRef(true);
  const requestingRef = useRef(false);

  const startVideoFallback = useCallback(async () => {
    try {
      if (!videoRef.current) {
        const video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.src = SILENT_VIDEO_DATA_URI;
        video.style.position = 'fixed';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0.001';
        video.style.pointerEvents = 'none';
        video.style.top = '-10px';
        document.body.appendChild(video);
        videoRef.current = video;
      }
      await videoRef.current.play();
      if (isMountedRef.current) setWakeLockActive(true);
      return true;
    } catch (_) {
      return false;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (requestingRef.current || document.visibilityState !== 'visible') return;
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      if (isMountedRef.current) setWakeLockActive(true);
      return;
    }

    requestingRef.current = true;
    try {
      if ('wakeLock' in navigator) {
        const sentinel = await navigator.wakeLock.request('screen');
        if (!isMountedRef.current) {
          sentinel.release().catch(() => {});
          return;
        }
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);

        sentinel.addEventListener('release', () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null;
            if (isMountedRef.current) {
              setWakeLockActive(Boolean(videoRef.current && !videoRef.current.paused));
            }
          }
        });
      } else {
        await startVideoFallback();
      }
    } catch (_) {
      const fallbackOk = await startVideoFallback();
      if (!fallbackOk && isMountedRef.current) {
        setWakeLockActive(false);
      }
    } finally {
      requestingRef.current = false;
    }
  }, [startVideoFallback]);

  useEffect(() => {
    isMountedRef.current = true;
    requestWakeLock();

    const handleWakeAttempt = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleWakeAttempt);
    window.addEventListener('focus', handleWakeAttempt);
    window.addEventListener('pageshow', handleWakeAttempt);
    window.addEventListener('pointerdown', handleWakeAttempt, { passive: true });
    window.addEventListener('touchstart', handleWakeAttempt, { passive: true });

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleWakeAttempt);
      window.removeEventListener('focus', handleWakeAttempt);
      window.removeEventListener('pageshow', handleWakeAttempt);
      window.removeEventListener('pointerdown', handleWakeAttempt);
      window.removeEventListener('touchstart', handleWakeAttempt);

      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.remove();
        } catch (_) {}
        videoRef.current = null;
      }
    };
  }, [requestWakeLock]);

  return {
    wakeLockActive,
    enableWakeLock: requestWakeLock,
  };
}
