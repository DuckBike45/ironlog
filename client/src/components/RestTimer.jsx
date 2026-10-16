import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Clock, BellRing } from 'lucide-react';

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    // Two-tone high chime: 880Hz (A5) -> 1046Hz (C6)
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) {}
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch (_) {}
  }
}

export default function RestTimer() {
  const DEFAULT_SECONDS = 120; // 2:00 minutes
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const targetEndTimeRef = useRef(null);

  // Sync remaining time using actual wall-clock time
  const updateTimerDelta = () => {
    if (!targetEndTimeRef.current || !isRunning) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));
    setTimeLeft(remaining);

    if (remaining <= 0) {
      targetEndTimeRef.current = null;
      setIsRunning(false);
      setIsFinished(true);
      playChime();
      triggerHaptic();
      try {
        localStorage.removeItem('ironlog_rest_target_end');
      } catch (_) {}
    }
  };

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(updateTimerDelta, 500);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Instantly re-check time whenever the screen unlocks, phone wakes up, or user focuses window
  useEffect(() => {
    const handleWake = () => {
      if (isRunning && targetEndTimeRef.current) {
        updateTimerDelta();
      }
    };

    document.addEventListener('visibilitychange', handleWake);
    window.addEventListener('focus', handleWake);
    window.addEventListener('pageshow', handleWake);
    return () => {
      document.removeEventListener('visibilitychange', handleWake);
      window.removeEventListener('focus', handleWake);
      window.removeEventListener('pageshow', handleWake);
    };
  }, [isRunning]);

  // Listen to external set completion event
  useEffect(() => {
    const handleStartRest = () => {
      const now = Date.now();
      const endTime = now + DEFAULT_SECONDS * 1000;
      targetEndTimeRef.current = endTime;
      setTimeLeft(DEFAULT_SECONDS);
      setIsFinished(false);
      setIsRunning(true);
      try {
        localStorage.setItem('ironlog_rest_target_end', String(endTime));
      } catch (_) {}
    };
    window.addEventListener('ironlog:start-rest', handleStartRest);
    return () => window.removeEventListener('ironlog:start-rest', handleStartRest);
  }, []);

  const startTimer = () => {
    const now = Date.now();
    const endTime = now + DEFAULT_SECONDS * 1000;
    targetEndTimeRef.current = endTime;
    setTimeLeft(DEFAULT_SECONDS);
    setIsFinished(false);
    setIsRunning(true);
    try {
      localStorage.setItem('ironlog_rest_target_end', String(endTime));
    } catch (_) {}
  };

  const togglePause = () => {
    if (isRunning) {
      // Pause: clear end time, keep current timeLeft
      targetEndTimeRef.current = null;
      setIsRunning(false);
      try {
        localStorage.removeItem('ironlog_rest_target_end');
      } catch (_) {}
    } else {
      // Resume from current timeLeft
      const secondsToRun = timeLeft > 0 ? timeLeft : DEFAULT_SECONDS;
      const endTime = Date.now() + secondsToRun * 1000;
      targetEndTimeRef.current = endTime;
      setIsRunning(true);
      setIsFinished(false);
      try {
        localStorage.setItem('ironlog_rest_target_end', String(endTime));
      } catch (_) {}
    }
  };

  const resetTimer = () => {
    targetEndTimeRef.current = null;
    setIsRunning(false);
    setIsFinished(false);
    setTimeLeft(DEFAULT_SECONDS);
    try {
      localStorage.removeItem('ironlog_rest_target_end');
    } catch (_) {}
  };

  const dismissAlert = () => {
    targetEndTimeRef.current = null;
    setIsFinished(false);
    setTimeLeft(DEFAULT_SECONDS);
    try {
      localStorage.removeItem('ironlog_rest_target_end');
    } catch (_) {}
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  // Progress percentage for subtle visual progress bar
  const progressPercent = Math.min(100, Math.max(0, ((DEFAULT_SECONDS - timeLeft) / DEFAULT_SECONDS) * 100));

  // Visual alert banner when timer finishes
  if (isFinished) {
    return (
      <div className="bg-amber-500 border-b border-amber-400 text-slate-950 px-4 py-2 flex items-center justify-between shadow-lg animate-pulse">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-slate-950 animate-bounce" />
          <span className="text-xs font-semibold">Rest Complete! (2:00)</span>
        </div>
        <button
          onClick={dismissAlert}
          className="px-2.5 py-1 bg-slate-950 text-amber-300 text-xs font-medium rounded-lg active:scale-95 transition-transform"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between shadow-sm transition-colors">
      {/* Background progress fill */}
      {isRunning && (
        <div
          className="absolute left-0 bottom-0 top-0 bg-blue-600/10 dark:bg-blue-500/10 transition-all pointer-events-none"
          style={{ width: `${progressPercent}%` }}
        />
      )}

      {/* Left: Clock Icon + Time Display */}
      <div className="relative flex items-center gap-2.5">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-medium text-xs transition-all ${
            isRunning
              ? 'bg-blue-600 text-white ring-2 ring-blue-500/40 animate-pulse'
              : 'bg-slate-150 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1.5">
            Rest
          </span>
          <span className="font-mono text-base font-semibold text-slate-900 dark:text-white">
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="relative flex items-center gap-1.5">
        {isRunning ? (
          <button
            onClick={togglePause}
            className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1 active:scale-95 transition-all"
          >
            <Pause className="w-3 h-3 fill-current" />
            <span>Pause</span>
          </button>
        ) : timeLeft < DEFAULT_SECONDS && timeLeft > 0 ? (
          <button
            onClick={togglePause}
            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium flex items-center gap-1 shadow-sm active:scale-95 transition-all"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Resume</span>
          </button>
        ) : (
          <button
            onClick={startTimer}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Start 2:00</span>
          </button>
        )}

        {timeLeft !== DEFAULT_SECONDS && (
          <button
            onClick={resetTimer}
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center active:scale-95 transition-all"
            title="Reset"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
