import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, X, BellRing, Plus, Minus } from 'lucide-react';

export default function RestTimer() {
  const DEFAULT_SECONDS = 120; // 2:00 minutes
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

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

  const adjustTime = (deltaSeconds) => {
    setTimeLeft((prev) => Math.max(0, prev + deltaSeconds));
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

  // Visual alert banner when timer finishes (silent per user requirement)
  if (isFinished) {
    return (
      <div className="fixed top-3 left-3 right-3 z-50 animate-bounce">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-slate-950 font-bold p-4 rounded-2xl shadow-2xl flex items-center justify-between border-2 border-amber-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-950 text-amber-400 rounded-xl animate-pulse">
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-extrabold uppercase tracking-wide">Rest Complete!</div>
              <div className="text-xs text-slate-900 font-medium">Ready for your next set (2:00 reached)</div>
            </div>
          </div>
          <button
            onClick={dismissAlert}
            className="px-4 py-2 bg-slate-950 text-amber-300 text-sm font-bold rounded-xl active:scale-95 transition-transform"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // If minimized while running or idle
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed top-3 right-3 z-40 px-3 py-1.5 rounded-full shadow-lg border flex items-center gap-2 text-xs font-semibold backdrop-blur-md transition-all ${
          isRunning
            ? 'bg-blue-600/90 text-white border-blue-400 animate-pulse'
            : 'bg-slate-800/80 text-slate-300 border-slate-700'
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
        <span>{formatTime(timeLeft)}</span>
      </button>
    );
  }

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-lg mb-4">
      <div className="flex items-center justify-between">
        {/* Timer Label & Quick Time Display */}
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-sm ${
              isRunning ? 'bg-blue-600 text-white ring-2 ring-blue-400/50' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Rest Timer</div>
            <div className="text-xl font-black font-mono tracking-tight text-white">
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* Quick Steppers & Controls */}
        <div className="flex items-center gap-1.5">
          {isRunning && (
            <>
              <button
                onClick={() => adjustTime(-30)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center active:bg-slate-700"
                title="-30s"
              >
                -30
              </button>
              <button
                onClick={() => adjustTime(30)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center active:bg-slate-700"
                title="+30s"
              >
                +30
              </button>
              <button
                onClick={togglePause}
                className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center border border-amber-500/30 active:scale-95"
                title="Pause"
              >
                <Pause className="w-4 h-4" />
              </button>
            </>
          )}

          {!isRunning && timeLeft < DEFAULT_SECONDS && timeLeft > 0 && (
            <button
              onClick={togglePause}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Resume
            </button>
          )}

          {!isRunning && timeLeft === DEFAULT_SECONDS && (
            <button
              onClick={startTimer}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/30 active:scale-95 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start 2:00
            </button>
          )}

          {timeLeft !== DEFAULT_SECONDS && (
            <button
              onClick={resetTimer}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center active:bg-slate-700"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsMinimized(true)}
            className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-300 flex items-center justify-center"
            title="Minimize"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
