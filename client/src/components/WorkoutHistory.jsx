import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  ChevronRight,
  Trash2,
  X,
  Edit3,
  Check,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
} from 'lucide-react';
import { api } from '../api';
import ExerciseSelectorModal from './ExerciseSelectorModal';

export default function WorkoutHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [replacingExercise, setReplacingExercise] = useState(null);

  // Refs for race-free set editing inside History Edit Mode
  const latestWorkoutRef = useRef(null);
  latestWorkoutRef.current = selectedWorkout;
  const updateDebounceTimers = useRef({});
  const clientKeyMapRef = useRef({});
  const pendingTempUpdatesRef = useRef({});
  const deletedTempIdsRef = useRef(new Set());

  const applyLocalWorkoutUpdate = (updaterFn) => {
    if (!latestWorkoutRef.current) return null;
    const next = updaterFn(latestWorkoutRef.current);
    latestWorkoutRef.current = next;
    setSelectedWorkout(next);
    setHasEdited(true);
    return next;
  };

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
      setIsEditing(false);
      setHasEdited(false);
      const detail = await api.getWorkoutDetails(workoutId);
      setSelectedWorkout(detail);
    } catch (err) {
      alert('Failed to load workout details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedWorkout(null);
    setIsEditing(false);
    if (hasEdited) {
      loadHistory();
      setHasEdited(false);
    }
  };

  const handleToggleEditMode = () => {
    if (isEditing && hasEdited) {
      loadHistory();
    }
    setIsEditing((prev) => !prev);
  };

  const handleDeleteWorkout = async (workoutId) => {
    if (!window.confirm('Are you sure you want to delete this workout from your history?')) return;
    try {
      await api.discardWorkout(workoutId);
      setSelectedWorkout(null);
      setIsEditing(false);
      loadHistory();
    } catch (err) {
      alert('Failed to delete workout');
    }
  };

  // --- Workout Metadata Editing (Name & Notes) ---
  const handleUpdateWorkoutField = (field, value) => {
    applyLocalWorkoutUpdate((w) => ({
      ...w,
      [field]: value,
    }));
  };

  const handleSaveWorkoutMeta = async () => {
    const current = latestWorkoutRef.current;
    if (!current) return;
    try {
      await api.updateWorkout(current.id, {
        name: current.name || 'Workout',
        notes: current.notes || '',
      });
    } catch (err) {
      console.error('Failed to update workout details', err);
    }
  };

  // --- Exercise Editing (Add, Swap, Reorder, Remove) ---
  const handleAddExercise = async (exercise) => {
    setShowAddExerciseModal(false);
    if (!selectedWorkout) return;
    try {
      const updated = await api.addExerciseToWorkout(selectedWorkout.id, exercise.id);
      setSelectedWorkout(updated);
      setHasEdited(true);
    } catch (err) {
      alert(err.message || 'Failed to add exercise');
    }
  };

  const handleSwapExercise = async (newExercise) => {
    if (!replacingExercise) return;
    const targetId = replacingExercise.id;
    setReplacingExercise(null);
    try {
      const updated = await api.replaceWorkoutExercise(targetId, newExercise.id);
      setSelectedWorkout(updated);
      setHasEdited(true);
    } catch (err) {
      alert(err.message || 'Failed to replace exercise');
    }
  };

  const handleMoveExercise = async (index, direction) => {
    const current = latestWorkoutRef.current;
    if (!current) return;
    const exercises = [...(current.exercises || [])];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= exercises.length) return;

    const previous = current;
    const [moved] = exercises.splice(index, 1);
    exercises.splice(targetIndex, 0, moved);

    const reordered = exercises.map((ex, idx) => ({
      ...ex,
      order_index: idx,
    }));

    applyLocalWorkoutUpdate((w) => ({
      ...w,
      exercises: reordered,
    }));

    try {
      await api.reorderWorkoutExercises(
        current.id,
        reordered.map((ex) => ex.id)
      );
    } catch (err) {
      setSelectedWorkout(previous);
      alert(err.message || 'Failed to reorder exercises');
    }
  };

  const handleRemoveExercise = async (workoutExerciseId) => {
    if (!window.confirm('Remove this exercise and its sets from this workout?')) return;
    try {
      const updated = await api.removeExerciseFromWorkout(workoutExerciseId);
      setSelectedWorkout(updated);
      setHasEdited(true);
    } catch (err) {
      alert(err.message || 'Failed to remove exercise');
    }
  };

  // --- Set Editing (Add, Update, Warmup, Delete) ---
  const handleAddSet = async (we) => {
    const currentWe = (latestWorkoutRef.current?.exercises || []).find((e) => e.id === we.id) || we;
    const existingSets = currentWe.sets || [];
    let defaultWeight = 60;
    let defaultReps = 10;

    if (existingSets.length > 0) {
      const lastSet = existingSets[existingSets.length - 1];
      defaultWeight = lastSet.weight != null && lastSet.weight !== '' ? parseFloat(lastSet.weight) : 60;
      defaultReps = lastSet.reps != null && lastSet.reps !== '' ? parseInt(lastSet.reps, 10) : 10;
    }

    const nextSetNumber = existingSets.length + 1;
    const optimisticSetId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const completedAt = latestWorkoutRef.current?.completed_at || new Date().toISOString();

    const optimisticSet = {
      id: optimisticSetId,
      workout_exercise_id: we.id,
      set_number: nextSetNumber,
      weight: defaultWeight,
      reps: defaultReps,
      is_warmup: 0,
      completed_at: completedAt,
      notes: null,
    };

    const previousWorkout = latestWorkoutRef.current;
    applyLocalWorkoutUpdate((w) => ({
      ...w,
      exercises: w.exercises.map((e) =>
        e.id === we.id ? { ...e, sets: [...(e.sets || []), optimisticSet] } : e
      ),
    }));

    try {
      const response = await api.addSet(we.id, {
        weight: defaultWeight,
        reps: defaultReps,
        is_warmup: 0,
        completed_at: completedAt,
      });

      const realSet = response.set;
      if (realSet && realSet.id) {
        if (deletedTempIdsRef.current.has(optimisticSetId)) {
          deletedTempIdsRef.current.delete(optimisticSetId);
          await api.deleteSet(realSet.id);
          return;
        }

        clientKeyMapRef.current[realSet.id] = optimisticSetId;

        applyLocalWorkoutUpdate((w) => ({
          ...w,
          exercises: w.exercises.map((e) =>
            e.id === we.id
              ? {
                  ...e,
                  sets: (e.sets || []).map((s) =>
                    s.id === optimisticSetId ? { ...s, id: realSet.id } : s
                  ),
                }
              : e
          ),
        }));

        const pendingUpdates = pendingTempUpdatesRef.current[optimisticSetId];
        if (pendingUpdates) {
          delete pendingTempUpdatesRef.current[optimisticSetId];
          await api.updateSet(realSet.id, pendingUpdates);
        }
      }
    } catch (err) {
      setSelectedWorkout(previousWorkout);
      alert(err.message || 'Failed to add set');
    }
  };

  const handleQuickUpdateSet = (set, field, rawValue) => {
    let cleanValue = rawValue;
    if (field === 'weight' || field === 'reps') {
      if (cleanValue !== '' && cleanValue !== '0' && !cleanValue.startsWith('0.')) {
        cleanValue = cleanValue.replace(/^0+(?=\d)/, '');
      }
    }

    applyLocalWorkoutUpdate((w) => ({
      ...w,
      exercises: w.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) =>
          s.id === set.id ? { ...s, [field]: cleanValue } : s
        ),
      })),
    }));

    const clientKey = clientKeyMapRef.current[set.id] || set.id;
    const timerKey = `${clientKey}_${field}`;
    if (updateDebounceTimers.current[timerKey]) {
      clearTimeout(updateDebounceTimers.current[timerKey]);
    }

    updateDebounceTimers.current[timerKey] = setTimeout(async () => {
      if (field === 'weight' || field === 'reps') {
        if (cleanValue === '') return;
        const numVal = field === 'weight' ? parseFloat(cleanValue) : parseInt(cleanValue, 10);
        if (isNaN(numVal)) return;

        if (String(set.id).startsWith('temp_')) {
          pendingTempUpdatesRef.current[set.id] = {
            ...(pendingTempUpdatesRef.current[set.id] || {}),
            [field]: numVal,
          };
          return;
        }

        try {
          await api.updateSet(set.id, { [field]: numVal });
        } catch (err) {
          console.error('Failed to sync set update', err);
        }
      } else if (field === 'notes') {
        const trimmed = cleanValue ? cleanValue.trim() : null;
        if (String(set.id).startsWith('temp_')) {
          pendingTempUpdatesRef.current[set.id] = {
            ...(pendingTempUpdatesRef.current[set.id] || {}),
            notes: trimmed,
          };
          return;
        }
        try {
          await api.updateSet(set.id, { notes: trimmed });
        } catch (err) {
          console.error('Failed to sync set note', err);
        }
      }
    }, 400);
  };

  const handleBlurSet = async (set, field, rawValue) => {
    let finalValue = rawValue;
    if (finalValue === '' || finalValue == null) {
      finalValue = field === 'weight' ? 0 : 1;
    } else {
      finalValue = field === 'weight' ? (parseFloat(finalValue) || 0) : (parseInt(finalValue, 10) || 1);
    }

    const clientKey = clientKeyMapRef.current[set.id] || set.id;
    const timerKey = `${clientKey}_${field}`;
    if (updateDebounceTimers.current[timerKey]) {
      clearTimeout(updateDebounceTimers.current[timerKey]);
    }

    applyLocalWorkoutUpdate((w) => ({
      ...w,
      exercises: w.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) =>
          s.id === set.id ? { ...s, [field]: finalValue } : s
        ),
      })),
    }));

    if (String(set.id).startsWith('temp_')) {
      pendingTempUpdatesRef.current[set.id] = {
        ...(pendingTempUpdatesRef.current[set.id] || {}),
        [field]: finalValue,
      };
      return;
    }

    try {
      await api.updateSet(set.id, { [field]: finalValue });
    } catch (err) {
      console.error('Failed to sync set on blur', err);
    }
  };

  const handleSaveSetNote = async (set, text) => {
    const trimmed = text ? text.trim() : null;
    const clientKey = clientKeyMapRef.current[set.id] || set.id;
    const timerKey = `${clientKey}_notes`;
    if (updateDebounceTimers.current[timerKey]) {
      clearTimeout(updateDebounceTimers.current[timerKey]);
    }

    applyLocalWorkoutUpdate((w) => ({
      ...w,
      exercises: w.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) =>
          s.id === set.id ? { ...s, notes: trimmed } : s
        ),
      })),
    }));

    if (String(set.id).startsWith('temp_')) {
      pendingTempUpdatesRef.current[set.id] = {
        ...(pendingTempUpdatesRef.current[set.id] || {}),
        notes: trimmed,
      };
      return;
    }

    try {
      await api.updateSet(set.id, { notes: trimmed });
    } catch (err) {
      console.error('Failed to save set note', err);
    }
  };

  const handleToggleWarmup = async (set) => {
    const newWarmup = set.is_warmup ? 0 : 1;
    const previousWorkout = latestWorkoutRef.current;

    applyLocalWorkoutUpdate((w) => ({
      ...w,
      exercises: w.exercises.map((e) => ({
        ...e,
        sets: (e.sets || []).map((s) =>
          s.id === set.id ? { ...s, is_warmup: newWarmup } : s
        ),
      })),
    }));

    if (String(set.id).startsWith('temp_')) {
      pendingTempUpdatesRef.current[set.id] = {
        ...(pendingTempUpdatesRef.current[set.id] || {}),
        is_warmup: newWarmup,
      };
      return;
    }

    try {
      await api.updateSet(set.id, { is_warmup: newWarmup });
    } catch (err) {
      setSelectedWorkout(previousWorkout);
      alert(err.message || 'Failed to toggle warmup');
    }
  };

  const handleDeleteSet = async (setId) => {
    const previousWorkout = latestWorkoutRef.current;

    applyLocalWorkoutUpdate((w) => ({
      ...w,
      exercises: w.exercises.map((e) => ({
        ...e,
        sets: (e.sets || [])
          .filter((s) => s.id !== setId)
          .map((s, idx) => ({ ...s, set_number: idx + 1 })),
      })),
    }));

    if (String(setId).startsWith('temp_')) {
      deletedTempIdsRef.current.add(setId);
      delete pendingTempUpdatesRef.current[setId];
      return;
    }

    try {
      await api.deleteSet(setId);
    } catch (err) {
      setSelectedWorkout(previousWorkout);
      alert(err.message || 'Failed to delete set');
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
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Workout History</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Review or edit your past training sessions</p>
        </div>
        <div className="px-3 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
          {history.length} logged
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading workouts...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/40 shadow-sm">
          <Calendar className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">No workouts recorded yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Start a workout in the Workout tab to log your first session!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((w) => (
            <button
              key={w.id}
              onClick={() => handleOpenDetail(w.id)}
              className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 hover:border-blue-400 dark:hover:border-slate-700 rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                    {w.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{formatDate(w.started_at)}</span>
                    <span>•</span>
                    <span>{formatTime(w.started_at)}</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-600 text-slate-500 dark:text-slate-400 group-hover:text-white flex items-center justify-center transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-center">
                <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Duration</div>
                  <div className="text-xs font-mono font-semibold text-slate-800 dark:text-white">{w.duration_minutes || 0} min</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Total Volume</div>
                  <div className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">{Math.round(w.total_volume_kg)} kg</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Sets</div>
                  <div className="text-xs font-mono font-semibold text-slate-800 dark:text-white">{w.total_sets} sets</div>
                </div>
              </div>

              {/* Exercises Performed Tags */}
              {w.exercise_names && w.exercise_names.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {w.exercise_names.map((name, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium"
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

      {/* Workout Detail & Edit Modal */}
      {selectedWorkout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center modal-safe-overlay">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-full flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={selectedWorkout.name || ''}
                    onChange={(e) => handleUpdateWorkoutField('name', e.target.value)}
                    onBlur={handleSaveWorkoutMeta}
                    placeholder="Workout name"
                    className="w-full text-base font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                    {selectedWorkout.name}
                  </h2>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatDate(selectedWorkout.started_at)} • {formatTime(selectedWorkout.started_at)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleEditMode}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 ${
                    isEditing
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {isEditing ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Done</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleCloseDetail}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:bg-slate-200 dark:active:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isEditing ? (
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Workout Notes
                  </label>
                  <input
                    type="text"
                    value={selectedWorkout.notes || ''}
                    onChange={(e) => handleUpdateWorkoutField('notes', e.target.value)}
                    onBlur={handleSaveWorkoutMeta}
                    placeholder="Add session notes..."
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              ) : (
                selectedWorkout.notes && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 italic">
                    "{selectedWorkout.notes}"
                  </div>
                )
              )}

              {selectedWorkout.exercises &&
                selectedWorkout.exercises.map((we, idx) => (
                  <div
                    key={we.id}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm block truncate">
                          {we.exercise_name}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-200/70 dark:bg-slate-800 rounded inline-block mt-0.5">
                          {we.exercise_category}
                        </span>
                      </div>

                      {isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          {selectedWorkout.exercises.length > 1 && (
                            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => handleMoveExercise(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-25"
                                title="Move up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveExercise(idx, 1)}
                                disabled={idx === selectedWorkout.exercises.length - 1}
                                className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-25"
                                title="Move down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setReplacingExercise(we)}
                            className="px-2 py-1 bg-slate-200/70 hover:bg-slate-300/70 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold rounded-lg flex items-center gap-1"
                            title="Swap exercise"
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                            <span>Swap</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveExercise(we.id)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded-lg"
                            title="Remove exercise"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <>
                        {we.sets && we.sets.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-1.5">
                              <div className="w-7 shrink-0 text-center">Set</div>
                              <div className="w-16 shrink-0 text-center">Weight</div>
                              <div className="w-12 shrink-0 text-center">Reps</div>
                              <div className="flex-1 min-w-[60px] pl-1">Comment</div>
                              <div className="w-6 shrink-0"></div>
                            </div>

                            {we.sets.map((s) => {
                              const rowKey = clientKeyMapRef.current[s.id] || s.id;
                              return (
                                <div
                                  key={rowKey}
                                  className={`flex items-center gap-1.5 p-1.5 rounded-xl border ${
                                    s.is_warmup
                                      ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleWarmup(s)}
                                    className="w-7 shrink-0 flex items-center justify-center gap-0.5 font-mono font-semibold text-xs active:scale-95"
                                    title="Tap to toggle Warmup (W)"
                                  >
                                    <span className="text-slate-600 dark:text-slate-300">#{s.set_number}</span>
                                    {s.is_warmup ? (
                                      <span className="text-[9px] px-0.5 bg-amber-200 dark:bg-amber-500 text-amber-900 dark:text-slate-950 font-bold rounded">
                                        W
                                      </span>
                                    ) : null}
                                  </button>

                                  <div className="w-16 shrink-0">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="0.5"
                                      value={s.weight ?? ''}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => handleQuickUpdateSet(s, 'weight', e.target.value)}
                                      onBlur={(e) => handleBlurSet(s, 'weight', e.target.value)}
                                      className="w-full rounded-lg py-1 px-1 text-center font-mono font-bold text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  <div className="w-12 shrink-0">
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      min="1"
                                      value={s.reps ?? ''}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => handleQuickUpdateSet(s, 'reps', e.target.value)}
                                      onBlur={(e) => handleBlurSet(s, 'reps', e.target.value)}
                                      className="w-full rounded-lg py-1 px-1 text-center font-mono font-bold text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  <div className="flex-1 min-w-[60px]">
                                    <input
                                      type="text"
                                      placeholder="Comment..."
                                      value={s.notes ?? ''}
                                      onChange={(e) => handleQuickUpdateSet(s, 'notes', e.target.value)}
                                      onBlur={(e) => handleSaveSetNote(s, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.target.blur();
                                      }}
                                      className="w-full rounded-lg py-1 px-1.5 text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-[9px] placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  <div className="w-6 shrink-0 flex items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSet(s.id)}
                                      className="p-1 text-slate-400 hover:text-red-500 rounded-lg active:scale-90"
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

                        <button
                          type="button"
                          onClick={() => handleAddSet(we)}
                          className="w-full py-1.5 px-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 border border-dashed border-slate-300 dark:border-slate-700 active:scale-[0.99]"
                        >
                          <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Add Set</span>
                        </button>
                      </>
                    ) : (
                      <div className="space-y-1">
                        {we.sets &&
                          we.sets.map((s) => (
                            <div
                              key={s.id}
                              className="py-1 px-2 rounded-lg bg-white dark:bg-slate-900/60 font-mono text-xs space-y-0.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400">
                                  Set {s.set_number} {s.is_warmup ? '(Warmup)' : ''}
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {s.weight} kg × {s.reps} reps
                                </span>
                              </div>
                              {s.notes && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans italic pl-1 border-l-2 border-blue-400">
                                  "{s.notes}"
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}

              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowAddExerciseModal(true)}
                  className="w-full py-2.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-[0.99]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Exercise to Workout</span>
                </button>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <button
                onClick={() => handleDeleteWorkout(selectedWorkout.id)}
                className="px-3 py-2 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 active:bg-red-50 dark:active:bg-red-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Workout
              </button>
              <button
                onClick={handleCloseDetail}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-semibold rounded-xl active:bg-slate-300 dark:active:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Exercise Modal for History Edit */}
      <ExerciseSelectorModal
        isOpen={showAddExerciseModal}
        onClose={() => setShowAddExerciseModal(false)}
        onSelect={handleAddExercise}
      />

      {/* Swap Exercise Modal for History Edit */}
      <ExerciseSelectorModal
        isOpen={Boolean(replacingExercise)}
        onClose={() => setReplacingExercise(null)}
        onSelect={handleSwapExercise}
      />
    </div>
  );
}
