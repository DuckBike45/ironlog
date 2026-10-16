import React, { useState, useEffect } from 'react';
import { Plus, X, Edit3, Trash2, Dumbbell, Play, Check, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { api } from '../api';
import ExerciseSelectorModal from './ExerciseSelectorModal';

export default function TemplateManager({ isOpen, onClose, onStartTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null); // null or { id, name, notes, exercise_ids: [] }
  const [isCreating, setIsCreating] = useState(false);
  
  // Template form state
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedExercises, setSelectedExercises] = useState([]); // array of exercise objects
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      resetForm();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const list = await api.getTemplates();
      setTemplates(list);
    } catch (err) {
      console.error('Failed to load templates', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingTemplate(null);
    setName('');
    setNotes('');
    setSelectedExercises([]);
    setError('');
  };

  const handleStartCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleStartEdit = (template) => {
    setIsCreating(false);
    setEditingTemplate(template);
    setName(template.name);
    setNotes(template.notes || '');
    setSelectedExercises(
      (template.exercises || []).map((e) => {
        let sets = [];
        if (e.sets_json) {
          try {
            sets = typeof e.sets_json === 'string' ? JSON.parse(e.sets_json) : e.sets_json;
          } catch (_) {}
        }
        if (!Array.isArray(sets) || sets.length === 0) {
          const count = parseInt(e.target_sets, 10) || 0;
          if (count > 0) {
            sets = Array.from({ length: count }, (_, i) => ({
              set_number: i + 1,
              weight: e.target_weight != null ? e.target_weight : '',
              reps: e.target_reps != null ? e.target_reps : '',
              is_warmup: false,
            }));
          }
        }
        return {
          id: e.exercise_id,
          name: e.exercise_name,
          category: e.exercise_category,
          sets: sets || [],
        };
      })
    );
    setError('');
  };

  const handleAddExerciseToTemplate = (exercise) => {
    setShowExercisePicker(false);
    if (!selectedExercises.some((e) => e.id === exercise.id)) {
      setSelectedExercises((prev) => [
        ...prev,
        {
          id: exercise.id,
          name: exercise.name,
          category: exercise.category,
          sets: [
            { set_number: 1, weight: '', reps: '', is_warmup: false },
          ],
        },
      ]);
    }
  };

  const handleAddSetToExercise = (exerciseIdx) => {
    setSelectedExercises((prev) => {
      const next = [...prev];
      const ex = next[exerciseIdx];
      const existingSets = ex.sets || [];
      const lastSet = existingSets[existingSets.length - 1];
      const newSet = {
        set_number: existingSets.length + 1,
        weight: lastSet ? lastSet.weight : '',
        reps: lastSet ? lastSet.reps : '',
        is_warmup: false,
      };
      next[exerciseIdx] = {
        ...ex,
        sets: [...existingSets, newSet],
      };
      return next;
    });
  };

  const handleUpdateSet = (exerciseIdx, setIdx, field, value) => {
    setSelectedExercises((prev) => {
      const next = [...prev];
      const ex = next[exerciseIdx];
      const updatedSets = [...(ex.sets || [])];
      updatedSets[setIdx] = {
        ...updatedSets[setIdx],
        [field]: value,
      };
      next[exerciseIdx] = { ...ex, sets: updatedSets };
      return next;
    });
  };

  const handleRemoveSet = (exerciseIdx, setIdx) => {
    setSelectedExercises((prev) => {
      const next = [...prev];
      const ex = next[exerciseIdx];
      const updatedSets = (ex.sets || [])
        .filter((_, i) => i !== setIdx)
        .map((s, i) => ({ ...s, set_number: i + 1 }));
      next[exerciseIdx] = { ...ex, sets: updatedSets };
      return next;
    });
  };

  const handleRemoveExerciseFromTemplate = (exerciseId) => {
    setSelectedExercises((prev) => prev.filter((e) => e.id !== exerciseId));
  };

  const handleMoveExercise = (index, delta) => {
    const newIdx = index + delta;
    if (newIdx < 0 || newIdx >= selectedExercises.length) return;
    const list = [...selectedExercises];
    const [moved] = list.splice(index, 1);
    list.splice(newIdx, 0, moved);
    setSelectedExercises(list);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const payload = {
        name: name.trim(),
        notes: notes.trim(),
        exercise_ids: selectedExercises.map((e) => e.id),
        exercises: selectedExercises.map((e) => ({
          exercise_id: e.id,
          sets: (e.sets || []).map((s, i) => ({
            set_number: i + 1,
            weight: s.weight !== '' && s.weight != null ? parseFloat(s.weight) : null,
            reps: s.reps !== '' && s.reps != null ? parseInt(s.reps, 10) : null,
            is_warmup: !!s.is_warmup,
          })),
        })),
      };

      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, payload);
      } else {
        await api.createTemplate(payload);
      }

      resetForm();
      loadTemplates();
    } catch (err) {
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Delete this workout template?')) return;
    try {
      await api.deleteTemplate(templateId);
      loadTemplates();
    } catch (err) {
      alert(err.message || 'Failed to delete template');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center modal-safe-overlay animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-full flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isCreating ? 'New Template' : editingTemplate ? 'Edit Template' : 'Workout Templates'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:bg-slate-200 dark:active:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-300 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Form Mode: Creating or Editing */}
          {isCreating || editingTemplate ? (
            <form onSubmit={handleSaveTemplate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Push Day A, Upper Body, Leg Day..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Focus on chest stretch, 3-4 working sets"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Exercises in Template */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Exercises ({selectedExercises.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowExercisePicker(true)}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    Add Exercise
                  </button>
                </div>

                {selectedExercises.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-400 dark:text-slate-500">
                    No exercises added yet. Tap "Add Exercise" to pick movements.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedExercises.map((ex, idx) => (
                      <div
                        key={ex.id}
                        className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 text-[10px] font-bold flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">{ex.name}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">{ex.category}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveExercise(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                              title="Move up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveExercise(idx, 1)}
                              disabled={idx === selectedExercises.length - 1}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                              title="Move down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveExerciseFromTemplate(ex.id)}
                              className="p-1 text-slate-400 hover:text-red-500 ml-1"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Per-Set Baseline Builder */}
                        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/60 space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                            <span>Target Sets ({ex.sets?.length || 0})</span>
                            <button
                              type="button"
                              onClick={() => handleAddSetToExercise(idx)}
                              className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-xs inline-flex items-center gap-1 active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              Add Set
                            </button>
                          </div>

                          {(!ex.sets || ex.sets.length === 0) ? (
                            <div className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
                              No baseline sets configured. (Sets can be logged freely during workout)
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="grid grid-cols-12 text-[10px] font-medium text-slate-500 dark:text-slate-400 px-1">
                                <div className="col-span-2">Set</div>
                                <div className="col-span-2 text-center">Warmup</div>
                                <div className="col-span-4 text-center">Weight (kg)</div>
                                <div className="col-span-3 text-center">Reps</div>
                                <div className="col-span-1"></div>
                              </div>
                              {ex.sets.map((s, sIdx) => (
                                <div
                                  key={sIdx}
                                  className={`grid grid-cols-12 items-center gap-1 border rounded-xl p-1.5 transition-colors ${
                                    s.is_warmup
                                      ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                                  }`}
                                >
                                  <div className="col-span-2 font-mono text-xs text-slate-600 dark:text-slate-400 pl-1 font-semibold flex items-center gap-1">
                                    <span>#{sIdx + 1}</span>
                                    {s.is_warmup && (
                                      <span className="text-[9px] px-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded font-semibold">
                                        W
                                      </span>
                                    )}
                                  </div>
                                  <div className="col-span-2 flex justify-center">
                                    <input
                                      type="checkbox"
                                      checked={!!s.is_warmup}
                                      onChange={(e) => handleUpdateSet(idx, sIdx, 'is_warmup', e.target.checked)}
                                      className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                                      title="Warmup set"
                                    />
                                  </div>
                                  <div className="col-span-4">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      placeholder="0"
                                      value={s.weight ?? ''}
                                      onChange={(e) => handleUpdateSet(idx, sIdx, 'weight', e.target.value)}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white text-center font-mono focus:outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div className="col-span-3">
                                    <input
                                      type="number"
                                      min="1"
                                      max="999"
                                      placeholder="0"
                                      value={s.reps ?? ''}
                                      onChange={(e) => handleUpdateSet(idx, sIdx, 'reps', e.target.value)}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white text-center font-mono focus:outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div className="col-span-1 flex justify-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSet(idx, sIdx)}
                                      className="text-slate-400 hover:text-red-500 p-1"
                                      title="Remove set"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  {editingTemplate ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </form>
          ) : (
            /* Templates List Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Save your standard routines for quick starts</span>
                <button
                  onClick={handleStartCreate}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  New Template
                </button>
              </div>

              {loading ? (
                <div className="text-center py-10 text-slate-400 text-xs">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                  <Dumbbell className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
                  <div className="text-sm font-bold text-slate-800 dark:text-white">No templates yet</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Create a template (e.g. "Push Day", "Pull Day") so you don't need to add each exercise manually every workout.
                  </p>
                  <button
                    onClick={handleStartCreate}
                    className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create First Template
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{tpl.name}</h3>
                          {tpl.notes && <p className="text-[11px] text-slate-500 dark:text-slate-400">{tpl.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(tpl)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Exercises badges */}
                      {tpl.exercises && tpl.exercises.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {tpl.exercises.map((e, idx) => {
                            let sets = [];
                            if (e.sets_json) {
                              try {
                                sets = typeof e.sets_json === 'string' ? JSON.parse(e.sets_json) : e.sets_json;
                              } catch (_) {}
                            }
                            const hasSets = Array.isArray(sets) && sets.length > 0;
                            const hasLegacy = e.target_sets || e.target_reps || (e.target_weight != null && e.target_weight !== '');
                            return (
                              <span
                                key={e.id || idx}
                                className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] text-slate-700 dark:text-slate-300 font-medium inline-flex items-center gap-1"
                              >
                                <span>{e.exercise_name}</span>
                                {hasSets ? (
                                  <span className="text-blue-600 dark:text-blue-400 font-mono text-[9px]">
                                    ({sets.length} {sets.length === 1 ? 'set' : 'sets'})
                                  </span>
                                ) : hasLegacy ? (
                                  <span className="text-blue-600 dark:text-blue-400 font-mono text-[9px]">
                                    ({e.target_sets ? `${e.target_sets}×` : ''}{e.target_reps ? `${e.target_reps}` : ''}
                                    {e.target_weight != null && e.target_weight !== '' ? ` @ ${e.target_weight}kg` : ''})
                                  </span>
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Start Workout with Template Button */}
                      <div className="pt-1">
                        <button
                          onClick={() => {
                            onClose();
                            onStartTemplate(tpl.id);
                          }}
                          className="w-full py-2 bg-blue-50 hover:bg-blue-600 dark:bg-blue-600/20 dark:hover:bg-blue-600 text-blue-700 hover:text-white dark:text-blue-400 dark:hover:text-white border border-blue-200 dark:border-blue-500/30 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Start Workout ({tpl.exercises?.length || 0} exercises)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Exercise Picker Modal for Template Form */}
        <ExerciseSelectorModal
          isOpen={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          onSelect={handleAddExerciseToTemplate}
        />

      </div>
    </div>
  );
}
