import React, { useState, useEffect } from 'react';
import { Lock, Delete, AlertCircle, Dumbbell, Sun, Moon } from 'lucide-react';
import { api } from '../api';

export default function PinEntry({ onSuccess, theme, onToggleTheme }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (pin.length === 6) {
      handleSubmit(pin);
    }
  }, [pin]);

  const handleSubmit = async (enteredPin) => {
    try {
      setLoading(true);
      setError('');
      const res = await api.verifyPin(enteredPin);
      if (res.mode === 'family') {
        onSuccess({ mode: 'family' });
      } else if (res.mode === 'demo') {
        onSuccess({ mode: 'demo', user: res.user });
      }
    } catch (err) {
      setError(err.message || 'Incorrect PIN. Please try again.');
      setShaking(true);
      setTimeout(() => {
        setShaking(false);
        setPin('');
      }, 700);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (digit) => {
    if (pin.length < 6 && !loading) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    if (!loading) {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center px-4 select-none relative safe-top safe-bottom transition-colors duration-200">
      {/* Theme Toggle Top Right */}
      {onToggleTheme && (
        <button
          onClick={onToggleTheme}
          className="absolute top-[max(env(safe-area-inset-top,0px),16px)] right-4 p-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm active:scale-95 transition-all"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      )}

      <div className="w-full max-w-xs flex flex-col items-center">
        {/* Logo / Header */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20 mb-3">
          <Dumbbell className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">IronLog</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 font-medium">Enter 6-digit access PIN</p>

        {/* PIN Dots Display */}
        <div className={`flex items-center justify-center gap-3 mb-6 ${shaking ? 'animate-shake' : ''}`}>
          {[...Array(6)].map((_, i) => {
            const isFilled = i < pin.length;
            return (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-emerald-500 shadow-md shadow-emerald-500/40 scale-110'
                    : 'border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium mb-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 py-1.5 px-3 rounded-xl animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() => handleKeyPress(String(digit))}
              className="h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-2xl font-semibold text-slate-800 dark:text-slate-100 active:bg-slate-100 dark:active:bg-slate-800 active:scale-95 transition-all flex items-center justify-center shadow-sm disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
          <div /> {/* blank spacer */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleKeyPress('0')}
            className="h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-2xl font-semibold text-slate-800 dark:text-slate-100 active:bg-slate-100 dark:active:bg-slate-800 active:scale-95 transition-all flex items-center justify-center shadow-sm disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 active:bg-slate-200 dark:active:bg-slate-800 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
