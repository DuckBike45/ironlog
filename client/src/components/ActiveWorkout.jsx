import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Check, Trash2, Edit3, X, Dumbbell, History, 
  ChevronDown, ChevronUp, AlertTriangle, Sparkles, ArrowLeftRight, MessageSquare 
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

  // Debounce timers for set inputs so typing is smooth and never gets interrupted
  const updateDebounceTimers = useRef({});

  // Collapse state for exercises: workoutExerciseId -> boolean (true = collapsed)
  const [collapsedExercises, setCollapsedExercises] = useState({});

  // Active set note inline edit: setId or null, and draft text
  const [editingNoteSetId, setEditingNoteSetId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

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

  const handleQuickUpdateSet = (set, field, rawValue) => {
    let cleanValue = rawValue;
    // Strip redundant leading zeros when typing (e.g. "05" -> "5", but keep "0" or "0.5")
    if (field === 'weight' || field === 'reps') {
      if (cleanValue !== '' && cleanValue !== '0' && !cleanValue.startsWith('0.')) {
        cleanValue = cleanValue.replace(/^0+(?=\d)/, '');
      }
    }

    // Instant optimistic UI update (allows empty string while user is deleting/typing!)
    const optimisticWorkout = {
      ...workout,
      exercises: workout.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) => {
          if (s.id === set.id) {
            return {
              ...s,
              [field]: cleanValue,
            };
          }
          return s;
        }),
      })),
    };
    onWorkoutUpdated(optimisticWorkout);

    // Clear previous timer for this field
    const timerKey = `${set.id}_${field}`;
    if (updateDebounceTimers.current[timerKey]) {
      clearTimeout(updateDebounceTimers.current[timerKey]);
    }

    // Debounce server update (400ms) - do NOT send empty string to server while user is typing
    updateDebounceTimers.current[timerKey] = setTimeout(async () => {
      if (cleanValue === '') return;
      const numVal = field === 'weight' ? parseFloat(cleanValue) : parseInt(cleanValue, 10);
      if (isNaN(numVal)) return;

      try {
        const response = await api.updateSet(set.id, {
          [field]: numVal,
        });
        onWorkoutUpdated(response.workout);
      } catch (err) {
        console.error('Failed to sync set update', err);
      }
    }, 400);
  };

  const handleBlurSet = async (set, field, rawValue) => {
    // If left completely blank on blur, fallback to safe defaults (0 for weight, 1 for reps)
    let finalValue = rawValue;
    if (finalValue === '' || finalValue == null) {
      finalValue = field === 'weight' ? 0 : 1;
    } else {
      finalValue = field === 'weight' ? (parseFloat(finalValue) || 0) : (parseInt(finalValue, 10) || 1);
    }

    const timerKey = `${set.id}_${field}`;
    if (updateDebounceTimers.current[timerKey]) {
      clearTimeout(updateDebounceTimers.current[timerKey]);
    }

    const optimisticWorkout = {
      ...workout,
      exercises: workout.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) => {
          if (s.id === set.id) {
            return {
              ...s,
              [field]: finalValue,
            };
          }
          return s;
        }),
      })),
    };
    onWorkoutUpdated(optimisticWorkout);

    try {
      const response = await api.updateSet(set.id, {
        [field]: finalValue,
      });
      onWorkoutUpdated(response.workout);
    } catch (err) {
      console.error('Failed to sync set on blur', err);
    }
  };

  const handleToggleWarmup = async (set) => {
    const newWarmup = set.is_warmup ? 0 : 1;
    const previousWorkout = workout;

    const optimisticWorkout = {
      ...workout,
      exercises: workout.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) => {
          if (s.id === set.id) {
            return { ...s, is_warmup: newWarmup };
          }
          return s;
        }),
      })),
    };
    onWorkoutUpdated(optimisticWorkout);

    try {
      const response = await api.updateSet(set.id, {
        is_warmup: newWarmup,
      });
      onWorkoutUpdated(response.workout);
    } catch (err) {
      onWorkoutUpdated(previousWorkout);
      alert(err.message || 'Failed to toggle warmup');
    }
  };

  const handleAddDirectSet = async (we) => {
    const existingSets = we.sets || [];
    let defaultWeight = 60;
    let defaultReps = 10;

    if (existingSets.length > 0) {
      const lastSet = existingSets[existingSets.length - 1];
      defaultWeight = lastSet.weight != null ? lastSet.weight : 60;
      defaultReps = lastSet.reps != null ? lastSet.reps : 10;
    } else {
      const perf = lastPerformances[we.exercise_id];
      if (perf && perf.found && perf.sets && perf.sets.length > 0) {
        defaultWeight = perf.sets[0].weight;
        defaultReps = perf.sets[0].reps;
      }
    }

    const nextSetNumber = existingSets.length + 1;
    const optimisticSetId = 'temp_' + Date.now();
    const optimisticSet = {
      id: optimisticSetId,
      workout_exercise_id: we.id,
      set_number: nextSetNumber,
      weight: defaultWeight,
      reps: defaultReps,
      is_warmup: 0,
      completed_at: null,
      notes: null,
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

    onWorkoutUpdated(optimisticWorkout);

    try {
      const response = await api.addSet(we.id, {
        weight: defaultWeight,
        reps: defaultReps,
        is_warmup: 0,
      });
      onWorkoutUpdated(response.workout);
    } catch (err) {
      onWorkoutUpdated(previousWorkout);
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

  const toggleExerciseCollapse = (workoutExerciseId, currentCollapsedState) => {
    setCollapsedExercises((prev) => ({
      ...prev,
      [workoutExerciseId]: !currentCollapsedState,
    }));
  };

  const handleStartEditNote = (set) => {
    if (editingNoteSetId === set.id) {
      setEditingNoteSetId(null);
      setEditingNoteText('');
    } else {
      setEditingNoteSetId(set.id);
      setEditingNoteText(set.notes || '');
    }
  };

  const handleSaveSetNote = async (setId, text) => {
    const trimmed = text ? text.trim() : null;
    const previousWorkout = workout;

    const optimisticWorkout = {
      ...workout,
      exercises: workout.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) => {
          if (s.id === setId) {
            return { ...s, notes: trimmed };
          }
          return s;
        }),
      })),
    };

    onWorkoutUpdated(optimisticWorkout);
    setEditingNoteSetId(null);
    setEditingNoteText('');

    try {
      const response = await api.updateSet(setId, { notes: trimmed });
      onWorkoutUpdated(response.workout);
    } catch (err) {
      onWorkoutUpdated(previousWorkout);
      alert(err.message || 'Failed to save note');
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
      {/* Top Header Bar (Solid background, guaranteed clearance below notch/status bar) */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 pb-3 pt-[max(calc(env(safe-area-inset-top,0px)+14px),64px)] flex items-center justify-between transition-colors shadow-xs">
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

      {/* Rest Timer (Floating bottom dock above navigation) */}
      <RestTimer />

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
          workout.exercises.map((we, idx) => {
            const currentInput = getInputState(we);
            const perf = lastPerformances[we.exercise_id];
            const isCollapsed = collapsedExercises[we.id] !== undefined ? collapsedExercises[we.id] : idx > 0;
            const totalSets = we.sets ? we.sets.length : 0;
            const completedSets = we.sets ? we.sets.filter((s) => !!s.completed_at).length : 0;

            return (
              <div
                key={we.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/90 rounded-3xl p-4 shadow-sm space-y-3"
              >
                {/* Exercise Header */}
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex-1 cursor-pointer select-none"
                    onClick={() => toggleExerciseCollapse(we.id, isCollapsed)}
                  >
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        {we.exercise_name}
                      </h3>
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium tracking-wide">
                        {we.exercise_category}
                      </span>
                      {totalSets > 0 && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            completedSets === totalSets
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {completedSets}/{totalSets} sets
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
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

                {/* Collapsible Exercise Body */}
                {!isCollapsed && (
                  <>
                    {/* Sets Table */}
                    {we.sets && we.sets.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2 pb-0.5">
                          <div className="w-7 shrink-0 text-center">Set</div>
                          <div className="w-16 shrink-0 text-center">Weight</div>
                          <div className="w-12 shrink-0 text-center">Reps</div>
                          <div className="flex-1 min-w-[70px] pl-1">Comment</div>
                          <div className="w-12 shrink-0 text-right pr-0.5">Done</div>
                        </div>

                        {we.sets.map((s) => {
                          const isCompleted = !!s.completed_at;

                          return (
                            <div
                              key={s.id}
                              className={`flex items-center gap-1.5 p-1.5 rounded-2xl transition-all ${
                                isCompleted
                                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                                  : s.is_warmup
                                  ? 'bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-950 dark:text-amber-100'
                                  : 'bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
                              }`}
                            >
                              {/* Set number & Warmup toggle (1-tap) */}
                              <button
                                type="button"
                                onClick={() => handleToggleWarmup(s)}
                                className="w-7 shrink-0 flex items-center justify-center gap-0.5 font-mono font-semibold text-xs active:scale-95 transition-transform"
                                title={s.is_warmup ? 'Warmup set (tap to make working set)' : 'Working set (tap to make warmup)'}
                              >
                                <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                                  #{s.set_number}
                                </span>
                                {s.is_warmup ? (
                                  <span className="text-[9px] px-0.5 bg-amber-200 dark:bg-amber-500 text-amber-900 dark:text-slate-950 font-bold rounded">
                                    W
                                  </span>
                                ) : null}
                              </button>

                              {/* Weight Input (Direct in set, auto-select on focus, debounced update) */}
                              <div className="w-16 shrink-0 text-center">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={s.weight ?? ''}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleQuickUpdateSet(s, 'weight', e.target.value)}
                                  onBlur={(e) => handleBlurSet(s, 'weight', e.target.value)}
                                  className={`w-full rounded-lg py-1 px-1 text-center font-mono font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors ${
                                    isCompleted
                                      ? 'bg-white/60 dark:bg-slate-900/40 border border-emerald-300/80 dark:border-emerald-600/40 text-emerald-950 dark:text-emerald-100'
                                      : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                  }`}
                                />
                              </div>

                              {/* Reps Input (Direct in set, auto-select on focus, debounced update, no 'r') */}
                              <div className="w-12 shrink-0 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={s.reps ?? ''}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleQuickUpdateSet(s, 'reps', e.target.value)}
                                  onBlur={(e) => handleBlurSet(s, 'reps', e.target.value)}
                                  className={`w-full rounded-lg py-1 px-1 text-center font-mono font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors ${
                                    isCompleted
                                      ? 'bg-white/60 dark:bg-slate-900/40 border border-emerald-300/80 dark:border-emerald-600/40 text-emerald-950 dark:text-emerald-100'
                                      : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                  }`}
                                />
                              </div>

                              {/* Comment Field (Ultra-compact 10px font and 9px placeholder) */}
                              <div className="flex-1 min-w-[70px]">
                                <input
                                  type="text"
                                  placeholder="Comment..."
                                  defaultValue={s.notes || ''}
                                  key={`${s.id}_${s.notes || ''}`}
                                  onBlur={(e) => {
                                    if (e.target.value !== (s.notes || '')) {
                                      handleSaveSetNote(s.id, e.target.value);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.target.blur();
                                    }
                                  }}
                                  className={`w-full rounded-lg py-1 px-1.5 text-[10px] text-slate-900 dark:text-white placeholder:text-[9px] placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-colors ${
                                    isCompleted
                                      ? 'bg-white/50 dark:bg-slate-900/30 border border-emerald-200/60 dark:border-emerald-700/40'
                                      : 'bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-900'
                                  }`}
                                />
                              </div>

                              {/* Actions: Compact Checkmark & Delete */}
                              <div className="w-12 shrink-0 flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSetComplete(s)}
                                  className={`w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all active:scale-90 ${
                                    isCompleted
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                                      : 'border border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                                  }`}
                                  title={isCompleted ? 'Mark incomplete' : 'Complete set'}
                                >
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSet(s.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded-lg active:scale-90 transition-transform"
                                  title="Delete set"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Direct + Add Set Button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleAddDirectSet(we)}
                        className="w-full py-1.5 px-3 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 border border-dashed border-slate-300 dark:border-slate-700"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5] text-blue-600 dark:text-blue-400" />
                        <span>Add Set</span>
                      </button>
                    </div>
                  </>
                )}
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

        {/* Bottom Finish / Discard Actions */}
        {workout.exercises && workout.exercises.length > 0 && (
          <div className="pt-3 flex items-center justify-between gap-3">
            <button
              onClick={() => onDiscardWorkout(workout.id)}
              className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-2xl active:bg-slate-100 dark:active:bg-slate-900 transition-colors"
            >
              Discard Workout
            </button>
            <button
              onClick={() => setShowFinishModal(true)}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-2xl shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              Finish Workout
            </button>
          </div>
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
