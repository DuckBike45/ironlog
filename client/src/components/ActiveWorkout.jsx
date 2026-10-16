import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Check, Trash2, Edit3, X, Dumbbell, History, 
  ChevronDown, ChevronUp, AlertTriangle, Sparkles, ArrowLeftRight 
} from 'lucide-react';
import { api } from '../api';
import RestTimer from './RestTimer';
import ExerciseSelectorModal from './ExerciseSelectorModal';
import ExerciseHistoryModal from './ExerciseHistoryModal';

// Isolated Timer Component: Only this tiny component re-renders every 1s, preventing the entire workout tree from re-rendering
function WorkoutDuration({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let raw = startedAt || '';
    if (raw && !raw.endsWith('Z') && !raw.includes('+')) {
      raw = raw.replace(' ', 'T') + 'Z';
    }
    const startTime = new Date(raw).getTime() || Date.now();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - startTime) / 1000)));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const formatted = hrs > 0
    ? `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`
    : `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">
      {formatted}
    </span>
  );
}

export default function ActiveWorkout({ workout, onWorkoutUpdated, onFinishWorkout, onDiscardWorkout }) {
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [workoutNotes, setWorkoutNotes] = useState(workout.notes || '');
  const [historyModalExercise, setHistoryModalExercise] = useState(null);
  const [replacingExercise, setReplacingExercise] = useState(null);

  // Screen Wake Lock: keeps display awake during active workouts
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          if (isMounted) setWakeLockActive(true);
          wakeLockRef.current.addEventListener('release', () => {
            if (isMounted) setWakeLockActive(false);
          });
        }
      } catch (err) {
        if (isMounted) setWakeLockActive(false);
      }
    };

    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Map of exerciseId -> { loading, found, sets, workout }
  const [lastPerformances, setLastPerformances] = useState({});

  // Local input drafts for fast set entry: exerciseId -> { weight, reps, is_warmup }
  const [setInputs, setSetInputs] = useState({});

  // Active inline editing set: { id, weight, reps, is_warmup } or null
  const [editingSet, setEditingSet] = useState(null);

  // Load last performance for all exercises in this workout
  useEffect(() => {
    if (workout.exercises) {
      workout.exercises.forEach((we) => {
        if (!lastPerformances[we.exercise_id]) {
          loadLastPerformance(we.exercise_id);
        }
      });
    }
  }, [workout.exercises]);

  const loadLastPerformance = async (exerciseId) => {
    try {
      const data = await api.getLastPerformance(exerciseId, workout.id);
      setLastPerformances((prev) => ({ ...prev, [exerciseId]: data }));
    } catch (err) {
      console.error('Failed to load performance for exercise', exerciseId, err);
    }
  };

  // Helper: Get or initialize draft inputs for an exercise
  const getInputState = (we) => {
    if (setInputs[we.id]) return setInputs[we.id];

    // Auto-fill heuristic:
    // 1. If this exercise has previous sets in this workout, copy the last set's weight & reps
    if (we.sets && we.sets.length > 0) {
      const lastSet = we.sets[we.sets.length - 1];
      return { weight: lastSet.weight.toString(), reps: lastSet.reps.toString(), is_warmup: false };
    }

    // 2. Otherwise, check last session's performance
    const perf = lastPerformances[we.exercise_id];
    if (perf && perf.found && perf.sets && perf.sets.length > 0) {
      const firstSet = perf.sets[0];
      return { weight: firstSet.weight.toString(), reps: firstSet.reps.toString(), is_warmup: false };
    }

    // 3. Fallback defaults
    return { weight: '60', reps: '10', is_warmup: false };
  };

  const updateInputState = (workoutExerciseId, field, value) => {
    setSetInputs((prev) => ({
      ...prev,
      [workoutExerciseId]: {
        ...getInputState(workout.exercises.find((e) => e.id === workoutExerciseId)),
        ...prev[workoutExerciseId],
        [field]: value,
      },
    }));
  };

  const handleAdjustWeight = (workoutExerciseId, delta) => {
    const current = getInputState(workout.exercises.find((e) => e.id === workoutExerciseId));
    const currentVal = parseFloat(current.weight) || 0;
    const newVal = Math.max(0, currentVal + delta);
    // Format nicely without excessive decimals
    updateInputState(workoutExerciseId, 'weight', (Math.round(newVal * 100) / 100).toString());
  };

  const handleAdjustReps = (workoutExerciseId, delta) => {
    const current = getInputState(workout.exercises.find((e) => e.id === workoutExerciseId));
    const currentVal = parseInt(current.reps, 10) || 0;
    const newVal = Math.max(1, currentVal + delta);
    updateInputState(workoutExerciseId, 'reps', newVal.toString());
  };

  const handleAddExercise = async (exercise) => {
    setShowExerciseModal(false);
    try {
      const updated = await api.addExerciseToWorkout(workout.id, exercise.id);
      onWorkoutUpdated(updated);
      loadLastPerformance(exercise.id);
    } catch (err) {
      alert(err.message || 'Failed to add exercise');
    }
  };

  const handleSwapExercise = async (newExercise) => {
    if (!replacingExercise) return;
    const targetExerciseId = replacingExercise.id;
    setReplacingExercise(null);
    try {
      const updated = await api.replaceWorkoutExercise(targetExerciseId, newExercise.id);
      onWorkoutUpdated(updated);
      loadLastPerformance(newExercise.id);
    } catch (err) {
      alert(err.message || 'Failed to replace exercise');
    }
  };

  const handleRemoveExercise = async (workoutExerciseId) => {
    if (!window.confirm('Remove this exercise from your workout?')) return;
    try {
      const updated = await api.removeExerciseFromWorkout(workoutExerciseId);
      onWorkoutUpdated(updated);
    } catch (err) {
      alert(err.message || 'Failed to remove exercise');
    }
  };

  const handleLogSet = async (we) => {
    const current = getInputState(we);
    const weight = parseFloat(current.weight);
    const reps = parseInt(current.reps, 10);

    if (isNaN(weight) || isNaN(reps) || reps <= 0) {
      alert('Please enter valid weight and reps');
      return;
    }

    // 1. Optimistic Update: Immediately reflect new set in UI (0ms latency)
    const optimisticSetId = 'temp_' + Date.now();
    const nextSetNumber = ((we.sets && we.sets.length) || 0) + 1;
    const optimisticSet = {
      id: optimisticSetId,
      workout_exercise_id: we.id,
      set_number: nextSetNumber,
      weight,
      reps,
      is_warmup: current.is_warmup ? 1 : 0,
      completed_at: new Date().toISOString(),
    };

    const previousWorkout = workout;
    const optimisticWorkout = {
      ...workout,
      exercises: workout.exercises.map((e) => {
        if (e.id === we.id) {
          return {
            ...e,
            sets: [...(e.sets || []), optimisticSet],
          };
        }
        return e;
      }),
    };

    // Instantly update UI and advance draft input
    onWorkoutUpdated(optimisticWorkout);
    setSetInputs((prev) => ({
      ...prev,
      [we.id]: {
        weight: weight.toString(),
        reps: reps.toString(),
        is_warmup: false,
      },
    }));

    try {
      const response = await api.addSet(we.id, {
        weight,
        reps,
        is_warmup: current.is_warmup ? 1 : 0,
      });

      // Reconcile with verified server response
      onWorkoutUpdated(response.workout);
    } catch (err) {
      // Revert on error
      onWorkoutUpdated(previousWorkout);
      alert(err.message || 'Failed to log set');
    }
  };

  const handleDeleteSet = async (setId) => {
    const previousWorkout = workout;
    // Optimistic delete
    const optimisticWorkout = {
      ...workout,
      exercises: workout.exercises.map((e) => ({
        ...e,
        sets: (e.sets || [])
          .filter((s) => s.id !== setId)
          .map((s, idx) => ({ ...s, set_number: idx + 1 })),
      })),
    };
    onWorkoutUpdated(optimisticWorkout);

    try {
      const response = await api.deleteSet(setId);
      onWorkoutUpdated(response.workout);
    } catch (err) {
      onWorkoutUpdated(previousWorkout);
      alert(err.message || 'Failed to delete set');
    }
  };

  const handleToggleSetComplete = async (set) => {
    const isNowComplete = !set.completed_at;
    const previousWorkout = workout;

    // Optimistic toggle
    const optimisticWorkout = {
      ...workout,
      exercises: workout.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) => {
          if (s.id === set.id) {
            return {
              ...s,
              completed_at: isNowComplete ? new Date().toISOString() : null,
            };
          }
          return s;
        }),
      })),
    };

    onWorkoutUpdated(optimisticWorkout);

    // If marked complete, trigger rest timer
    if (isNowComplete) {
      window.dispatchEvent(new CustomEvent('ironlog:start-rest'));
    }

    try {
      const response = await api.toggleSetComplete(set.id);
      onWorkoutUpdated(response.workout);
    } catch (err) {
      onWorkoutUpdated(previousWorkout);
      alert(err.message || 'Failed to toggle set completion');
    }
  };

  const handleQuickUpdateSet = async (set, field, value) => {
    const updatedWeight = field === 'weight' ? (value === '' ? 0 : parseFloat(value)) : set.weight;
    const updatedReps = field === 'reps' ? (value === '' ? 0 : parseInt(value, 10)) : set.reps;

    // Optimistic update
    const previousWorkout = workout;
    const optimisticWorkout = {
      ...workout,
      exercises: workout.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) => {
          if (s.id === set.id) {
            return {
              ...s,
              [field]: value,
            };
          }
          return s;
        }),
      })),
    };
    onWorkoutUpdated(optimisticWorkout);

    try {
      const response = await api.updateSet(set.id, {
        weight: isNaN(updatedWeight) ? 0 : updatedWeight,
        reps: isNaN(updatedReps) ? 0 : updatedReps,
        is_warmup: set.is_warmup,
      });
      onWorkoutUpdated(response.workout);
    } catch (err) {
      onWorkoutUpdated(previousWorkout);
    }
  };

  const handleQuickAddSet = async (we) => {
    const sets = we.sets || [];
    const lastSet = sets[sets.length - 1];
    const weight = lastSet ? lastSet.weight : 60;
    const reps = lastSet ? lastSet.reps : 10;
    const is_warmup = 0;

    try {
      const response = await api.addSet(we.id, { weight, reps, is_warmup });
      onWorkoutUpdated(response.workout);
    } catch (err) {
      alert(err.message || 'Failed to add set');
    }
  };

  const handleStartEditSet = (set) => {
    setEditingSet({
      id: set.id,
      weight: set.weight.toString(),
      reps: set.reps.toString(),
      is_warmup: !!set.is_warmup,
    });
  };

  const handleSaveEditSet = async () => {
    if (!editingSet) return;
    const previousWorkout = workout;
    const updatedWeight = parseFloat(editingSet.weight);
    const updatedReps = parseInt(editingSet.reps, 10);
    const updatedWarmup = editingSet.is_warmup ? 1 : 0;

    // Optimistic edit
    const optimisticWorkout = {
      ...workout,
      exercises: workout.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) => {
          if (s.id === editingSet.id) {
            return {
              ...s,
              weight: updatedWeight,
              reps: updatedReps,
              is_warmup: updatedWarmup,
            };
          }
          return s;
        }),
      })),
    };

    onWorkoutUpdated(optimisticWorkout);
    setEditingSet(null);

    try {
      const response = await api.updateSet(editingSet.id, {
        weight: updatedWeight,
        reps: updatedReps,
        is_warmup: updatedWarmup,
      });
      onWorkoutUpdated(response.workout);
    } catch (err) {
      onWorkoutUpdated(previousWorkout);
      alert(err.message || 'Failed to update set');
    }
  };

  const confirmFinish = async () => {
    try {
      await onFinishWorkout(workout.id, workoutNotes);
      setShowFinishModal(false);
    } catch (err) {
      alert(err.message || 'Failed to finish workout');
    }
  };

  return (
    <div className="pb-28">
      {/* Top Header Bar (Scrolls away with page, respects iOS safe area / notch) */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80 px-4 pb-3 safe-top flex items-center justify-between transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
              Active Workout
            </span>
            {wakeLockActive && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Screen On
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <WorkoutDuration startedAt={workout.started_at} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onDiscardWorkout(workout.id)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 active:scale-95 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={() => setShowFinishModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            Finish
          </button>
        </div>
      </div>

      {/* Floating Rest Timer bar (Sticks to top beneath iOS status bar with seamless background coverage) */}
      <div className="sticky top-0 z-30 shadow-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <RestTimer />
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">

        {/* Exercises List */}
        {workout.exercises && workout.exercises.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/60 dark:bg-slate-900/40">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
              <Dumbbell className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Your workout is empty</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto">
              Tap below to choose your first exercise and start logging sets!
            </p>
            <button
              onClick={() => setShowExerciseModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-2xl inline-flex items-center gap-2 shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Exercise
            </button>
          </div>
        ) : (
          workout.exercises.map((we) => {
            const currentInput = getInputState(we);
            const perf = lastPerformances[we.exercise_id];

            return (
              <div
                key={we.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/90 rounded-3xl p-4 shadow-sm space-y-3"
              >
                {/* Exercise Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{we.exercise_name}</h3>
                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium tracking-wide mt-0.5">
                      {we.exercise_category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Swap / Replace button */}
                    <button
                      type="button"
                      onClick={() => setReplacingExercise(we)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                      title="Replace exercise (retains sets & order)"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Swap</span>
                    </button>

                    <button
                      onClick={() =>
                        setHistoryModalExercise({
                          id: we.exercise_id,
                          name: we.exercise_name,
                          category: we.exercise_category,
                        })
                      }
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-xl flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                      title="View chronological history for this exercise"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>History</span>
                    </button>
                    <button
                      onClick={() => handleRemoveExercise(we.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
                      title="Remove exercise"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Previous Performance Context Pill */}
                {perf && perf.found && (
                  <div className="p-2.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 rounded-xl flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">Last Session: </span>
                      {perf.sets.map((s, idx) => (
                        <span key={s.id} className="font-mono font-medium">
                          {s.weight}kg × {s.reps}
                          {idx < perf.sets.length - 1 ? '  •  ' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sets Table */}
                {we.sets && we.sets.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="grid grid-cols-12 text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2">
                      <div className="col-span-2">Set</div>
                      <div className="col-span-4 text-center">Weight</div>
                      <div className="col-span-3 text-center">Reps</div>
                      <div className="col-span-3 text-right">Complete</div>
                    </div>

                    {we.sets.map((s) => {
                      const isCompleted = !!s.completed_at;

                      return (
                        <div
                          key={s.id}
                          className={`grid grid-cols-12 items-center p-2 rounded-2xl text-sm transition-all ${
                            isCompleted
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                              : s.is_warmup
                              ? 'bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-950 dark:text-amber-100'
                              : 'bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
                          }`}
                        >
                          {/* Set number */}
                          <div className="col-span-2 flex items-center gap-1 font-mono font-semibold">
                            <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}>
                              #{s.set_number}
                            </span>
                            {s.is_warmup ? (
                              <span className="text-[10px] px-1 bg-amber-200 dark:bg-amber-500 text-amber-900 dark:text-slate-950 font-bold rounded">
                                W
                              </span>
                            ) : null}
                          </div>

                          {/* Weight */}
                          <div className="col-span-4 text-center font-mono font-semibold text-sm">
                            {!isCompleted ? (
                              <div className="inline-flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={s.weight ?? ''}
                                  onChange={(e) => handleQuickUpdateSet(s, 'weight', e.target.value)}
                                  className="w-14 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg py-1 px-1 text-center font-mono font-semibold text-xs focus:outline-none focus:border-blue-500"
                                />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">kg</span>
                              </div>
                            ) : (
                              <span>
                                {s.weight} <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">kg</span>
                              </span>
                            )}
                          </div>

                          {/* Reps */}
                          <div className="col-span-3 text-center font-mono font-semibold text-sm">
                            {!isCompleted ? (
                              <div className="inline-flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={s.reps ?? ''}
                                  onChange={(e) => handleQuickUpdateSet(s, 'reps', e.target.value)}
                                  className="w-12 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg py-1 px-1 text-center font-mono font-semibold text-xs focus:outline-none focus:border-blue-500"
                                />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">reps</span>
                              </div>
                            ) : (
                              <span>
                                {s.reps} <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">reps</span>
                              </span>
                            )}
                          </div>

                          {/* Actions: Complete Checkmark & Delete */}
                          <div className="col-span-3 flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleSetComplete(s)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                                isCompleted
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                  : 'border-2 border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                              }`}
                              title={isCompleted ? 'Mark incomplete' : 'Complete set'}
                            >
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            </button>
                            <button
                              onClick={() => handleDeleteSet(s.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg active:scale-90 transition-transform"
                              title="Delete set"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Quick Add Set button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleQuickAddSet(we)}
                        className="w-full py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        Add Set
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Set Edit Modal / Drawer if editing */}
                {editingSet && we.sets.some((s) => s.id === editingSet.id) && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-2xl space-y-2">
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400">Edit Set</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Weight (KG)</label>
                        <input
                          type="number"
                          step="0.5"
                          inputMode="decimal"
                          value={editingSet.weight}
                          onChange={(e) =>
                            setEditingSet((prev) => ({ ...prev, weight: e.target.value }))
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2 text-sm font-mono font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Reps</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editingSet.reps}
                          onChange={(e) =>
                            setEditingSet((prev) => ({ ...prev, reps: e.target.value }))
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2 text-sm font-mono font-semibold"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingSet.is_warmup}
                          onChange={(e) =>
                            setEditingSet((prev) => ({ ...prev, is_warmup: e.target.checked }))
                          }
                          className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-blue-600"
                        />
                        Warmup set
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingSet(null)}
                          className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEditSet}
                          className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-sm"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* FAST SET ENTRY FORM (The Ergonomic Core) */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Weight Input */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Weight (KG)</label>
                      </div>
                      <input
                        type="number"
                        step="0.5"
                        inputMode="decimal"
                        value={currentInput.weight}
                        onChange={(e) => updateInputState(we.id, 'weight', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 text-xl font-mono font-bold text-center focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                    </div>

                    {/* Reps Input */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Reps</label>
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={currentInput.reps}
                        onChange={(e) => updateInputState(we.id, 'reps', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 text-xl font-mono font-bold text-center focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Warmup Checkbox & 1-TAP "LOG SET" BUTTON */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => updateInputState(we.id, 'is_warmup', !currentInput.is_warmup)}
                      className={`px-3 py-3 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                        currentInput.is_warmup
                          ? 'bg-amber-100 dark:bg-amber-500 border-amber-300 dark:border-amber-400 text-amber-900 dark:text-slate-950 font-bold'
                          : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                      title="Mark as warm-up set"
                    >
                      Warmup
                    </button>
                    <button
                      onClick={() => handleLogSet(we)}
                      className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                      Log Set
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Add Exercise Floating / Bottom Button */}
        {workout.exercises && workout.exercises.length > 0 && (
          <button
            onClick={() => setShowExerciseModal(true)}
            className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold text-sm flex items-center justify-center gap-2 active:bg-slate-100 dark:active:bg-slate-900 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Another Exercise
          </button>
        )}
      </div>

      {/* Exercise Selector Modal (Add Exercise) */}
      <ExerciseSelectorModal
        isOpen={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        onSelect={handleAddExercise}
      />

      {/* Exercise Swap / Replacement Modal */}
      <ExerciseSelectorModal
        isOpen={Boolean(replacingExercise)}
        onClose={() => setReplacingExercise(null)}
        onSelect={handleSwapExercise}
      />

      {/* Finish Workout Confirmation Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Check className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Finish Workout?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">Duration: <WorkoutDuration startedAt={workout.started_at} /></p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Workout Notes (optional)</label>
              <textarea
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                placeholder="Great session, felt strong today..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 h-20 placeholder-slate-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowFinishModal(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
              >
                Continue Workout
              </button>
              <button
                onClick={confirmFinish}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-sm active:scale-95 transition-all"
              >
                Yes, Finish!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise History Slide-up Modal */}
      <ExerciseHistoryModal
        isOpen={!!historyModalExercise}
        onClose={() => setHistoryModalExercise(null)}
        exerciseId={historyModalExercise?.id}
        exerciseName={historyModalExercise?.name}
        exerciseCategory={historyModalExercise?.category}
      />
    </div>
  );
}
