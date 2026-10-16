import React, { useState, useEffect } from 'react';
import { X, Calendar, Dumbbell, History, TrendingUp } from 'lucide-react';
import { api } from '../api';

export default function ExerciseHistoryModal({ isOpen, onClose, exerciseId, exerciseName, exerciseCategory }) {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && exerciseId) {
      loadHistory();
    }
  }, [isOpen, exerciseId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getExerciseHistory(exerciseId);
      setHistoryData(data);
    } catch (err) {
      console.error('Failed to load exercise history', err);
      setError('Failed to load history for this exercise');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{exerciseName || historyData?.exercise?.name}</h2>
            </div>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-400 text-[10px] font-medium tracking-wide">
              {exerciseCategory || historyData?.exercise?.category || 'Exercise'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Loading performance history...</div>
          ) : error ? (
            <div className="p-3 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-300 text-xs rounded-xl text-center">
              {error}
            </div>
          ) : !historyData || historyData.sessions.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40">
              <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-800 dark:text-white">No history yet</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Sets logged for this exercise in completed workouts will appear here chronologically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>Chronological Progress</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{historyData.sessions.length} sessions logged</span>
              </div>

              {historyData.sessions.map((session, sIdx) => {
                const sessionVolume = session.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

                return (
                  <div
                    key={session.workout_id || sIdx}
                    className="bg-slate-50/80 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-3.5 space-y-2.5 shadow-xs"
                  >
                    {/* Session Header */}
                    <div className="flex items-start justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">{formatDate(session.completed_at)}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{session.workout_name}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">Volume</span>
                        <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{Math.round(sessionVolume)} kg</span>
                      </div>
                    </div>

                    {/* Sets List */}
                    <div className="space-y-1">
                      {session.sets.map((set) => (
                        <div
                          key={set.id}
                          className="py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900/70 text-xs font-mono border border-slate-100 dark:border-transparent space-y-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500 dark:text-slate-400 font-medium">Set {set.set_number}</span>
                              {set.is_warmup ? (
                                <span className="text-[9px] px-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-sans font-bold rounded">
                                  W
                                </span>
                              ) : null}
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              <span>{set.weight} kg</span>
                              <span className="text-slate-400 mx-1.5">×</span>
                              <span>{set.reps} reps</span>
                            </div>
                          </div>
                          {set.notes && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans italic pl-1 border-l-2 border-blue-400">
                              "{set.notes}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
