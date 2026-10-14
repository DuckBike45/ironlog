import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Dumbbell, ChevronRight, Trash2, X, Trophy } from 'lucide-react';
import { api } from '../api';

export default function WorkoutHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getWorkoutHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (workoutId) => {
    try {
      setLoadingDetail(true);
      const detail = await api.getWorkoutDetails(workoutId);
      setSelectedWorkout(detail);
    } catch (err) {
      alert('Failed to load workout details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteWorkout = async (workoutId) => {
    if (!window.confirm('Are you sure you want to delete this workout from your history?')) return;
    try {
      await api.discardWorkout(workoutId);
      setSelectedWorkout(null);
      loadHistory();
    } catch (err) {
      alert('Failed to delete workout');
    }
  };

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

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-28 space-y-4 safe-top">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Workout History</h1>
          <p className="text-xs text-slate-400">Review your past training sessions</p>
        </div>
        <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300">
          {history.length} logged
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading workouts...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/40">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">No workouts recorded yet</h3>
          <p className="text-xs text-slate-400 mt-1">Start a workout in the Workout tab to log your first session!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((w) => (
            <button
              key={w.id}
              onClick={() => handleOpenDetail(w.id)}
              className="w-full text-left bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 shadow-lg active:scale-[0.99] transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                    {w.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{formatDate(w.started_at)}</span>
                    <span>•</span>
                    <span>{formatTime(w.started_at)}</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 group-hover:bg-blue-600 text-slate-400 group-hover:text-white flex items-center justify-center transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/60 text-center">
                <div className="bg-slate-950/60 p-2 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Duration</div>
                  <div className="text-xs font-mono font-bold text-white">{w.duration_minutes || 0} min</div>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Volume</div>
                  <div className="text-xs font-mono font-bold text-blue-400">{Math.round(w.total_volume_kg)} kg</div>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Sets</div>
                  <div className="text-xs font-mono font-bold text-white">{w.total_sets} sets</div>
                </div>
              </div>

              {/* Exercises Performed Tags */}
              {w.exercise_names && w.exercise_names.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {w.exercise_names.map((name, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Workout Detail Modal */}
      {selectedWorkout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-white">{selectedWorkout.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{formatDate(selectedWorkout.started_at)}</p>
              </div>
              <button
                onClick={() => setSelectedWorkout(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center active:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedWorkout.notes && (
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 italic">
                  "{selectedWorkout.notes}"
                </div>
              )}

              {selectedWorkout.exercises && selectedWorkout.exercises.map((we) => (
                <div key={we.id} className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{we.exercise_name}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5 bg-slate-800 rounded">
                      {we.exercise_category}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {we.sets && we.sets.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900/60 font-mono"
                      >
                        <span className="text-slate-400">
                          Set {s.set_number} {s.is_warmup ? '(Warmup)' : ''}
                        </span>
                        <span className="font-bold text-white">
                          {s.weight} kg × {s.reps} reps
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <button
                onClick={() => handleDeleteWorkout(selectedWorkout.id)}
                className="px-3 py-2 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl flex items-center gap-1.5 active:bg-red-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Workout
              </button>
              <button
                onClick={() => setSelectedWorkout(null)}
                className="px-5 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl active:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
