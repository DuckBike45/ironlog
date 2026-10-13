import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, BellRing } from 'lucide-react';

export default function RestTimer() {
  const DEFAULT_SECONDS = 120; // 2:00 minutes
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const startTimer = () => {
    setTimeLeft(DEFAULT_SECONDS);
    setIsFinished(false);
    setIsRunning(true);
  };

  const togglePause = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsFinished(false);
    setTimeLeft(DEFAULT_SECONDS);
  };

  const dismissAlert = () => {
    setIsFinished(false);
    setTimeLeft(DEFAULT_SECONDS);
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  // Progress percentage for subtle visual progress bar
  const progressPercent = Math.min(100, Math.max(0, ((DEFAULT_SECONDS - timeLeft) / DEFAULT_SECONDS) * 100));

  // Visual alert banner when timer finishes (silent alert)
  if (isFinished) {
    return (
      <div className="bg-amber-500 border-b border-amber-400 text-slate-950 px-4 py-2 flex items-center justify-between shadow-lg animate-pulse">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-slate-950 animate-bounce" />
          <span className="text-xs font-black uppercase tracking-wider">Rest Complete! (2:00)</span>
        </div>
        <button
          onClick={dismissAlert}
          className="px-2.5 py-1 bg-slate-950 text-amber-300 text-[11px] font-bold rounded-lg active:scale-95 transition-transform"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="relative bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-2 flex items-center justify-between shadow-sm">
      {/* Background progress fill */}
      {isRunning && (
        <div
          className="absolute left-0 bottom-0 top-0 bg-blue-600/10 transition-all pointer-events-none"
          style={{ width: `${progressPercent}%` }}
        />
      )}

      {/* Left: Clock Icon + Time Display */}
      <div className="relative flex items-center gap-2.5">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs transition-all ${
            isRunning
              ? 'bg-blue-600 text-white ring-2 ring-blue-500/40 animate-pulse'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1.5">
            Rest
          </span>
          <span className="font-mono text-base font-black text-white">
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="relative flex items-center gap-1.5">
        {isRunning ? (
          <button
            onClick={togglePause}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
          >
            <Pause className="w-3 h-3 fill-current" />
            <span>Pause</span>
          </button>
        ) : timeLeft < DEFAULT_SECONDS && timeLeft > 0 ? (
          <button
            onClick={togglePause}
            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-blue-600/30 active:scale-95 transition-all"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Resume</span>
          </button>
        ) : (
          <button
            onClick={startTimer}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 active:scale-95 transition-all"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Start 2:00</span>
          </button>
        )}

        {timeLeft !== DEFAULT_SECONDS && (
          <button
            onClick={resetTimer}
            className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center active:scale-95 transition-all"
            title="Reset"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
