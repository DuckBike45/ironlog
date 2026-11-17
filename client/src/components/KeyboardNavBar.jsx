import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

/**
 * Compact floating accessory bar anchored above the mobile virtual keyboard.
 * Lets users jump Weight -> Reps -> Comment -> Done in one tap even on iOS numeric keypads.
 */
export default function KeyboardNavBar({
  visible,
  onPrev,
  onNext,
  onDone,
  canPrev = true,
  canNext = true,
  currentField = '',
}) {
  const [bottomOffset, setBottomOffset] = useState(0);

  useEffect(() => {
    if (!visible) {
      setBottomOffset(0);
      return;
    }

    const updateOffset = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setBottomOffset(0);
        return;
      }
      const offset = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
      setBottomOffset(offset);
    };

    updateOffset();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', updateOffset);
      vv.addEventListener('scroll', updateOffset);
    }
    window.addEventListener('resize', updateOffset);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateOffset);
        vv.removeEventListener('scroll', updateOffset);
      }
      window.removeEventListener('resize', updateOffset);
    };
  }, [visible]);

  if (!visible) return null;

  const preventBlur = (e) => {
    e.preventDefault();
  };

  const nextHint =
    currentField === 'weight'
      ? 'Reps'
      : currentField === 'reps'
      ? 'Comment'
      : 'Done';

  return (
    <div
      style={{ bottom: `${bottomOffset}px` }}
      className="fixed left-0 right-0 z-50 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-between shadow-lg transition-[bottom] duration-75"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onPointerDown={preventBlur}
          onMouseDown={preventBlur}
          onClick={onPrev}
          disabled={!canPrev}
          className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-35 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all shadow-xs"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>

        <button
          type="button"
          onPointerDown={preventBlur}
          onMouseDown={preventBlur}
          onClick={onNext}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all shadow-xs"
        >
          <span>{canNext ? `Next (${nextHint})` : 'Done'}</span>
          {canNext ? <ChevronRight className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
        </button>
      </div>

      <button
        type="button"
        onPointerDown={preventBlur}
        onMouseDown={preventBlur}
        onClick={onDone}
        className="px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold active:scale-95 transition-all"
      >
        Done
      </button>
    </div>
  );
}
