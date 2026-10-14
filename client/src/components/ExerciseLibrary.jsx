import React, { useState, useEffect } from 'react';
import { Search, Plus, Dumbbell, X, Sparkles, Check, ChevronRight, Edit2 } from 'lucide-react';
import { api } from '../api';
import ExerciseHistoryModal from './ExerciseHistoryModal';

const CATEGORIES = ['All', '⭐ Frequently Used', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other'];

export default function ExerciseLibrary() {
  const [exercises, setExercises] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectedExerciseForHistory, setSelectedExerciseForHistory] = useState(null);

  // New exercise form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Chest');
  const [newNotes, setNewNotes] = useState('');
  const [error, setError] = useState('');

  // Edit exercise form
  const [editingExercise, setEditingExercise] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Chest');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    try {
      setLoading(true);
      const data = await api.getExercises();
      setExercises(data);
    } catch (err) {
      console.error('Failed to load exercises', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExercise = (exercise) => {
    setSelectedExerciseForHistory(exercise);
  };

  const handleStartEdit = (exercise) => {
    setEditingExercise(exercise);
    setEditName(exercise.name);
    setEditCategory(exercise.category);
    setEditNotes(exercise.notes || '');
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;

    try {
      setSavingEdit(true);
      setEditError('');
      await api.updateExercise(editingExercise.id, {
        name: editName.trim(),
        category: editCategory,
        notes: editNotes.trim(),
      });
      setEditingExercise(null);
      await loadExercises();
    } catch (err) {
      setEditError(err.message || 'Failed to update exercise');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateExercise = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setError('');
      await api.createExercise({
        name: newName.trim(),
        category: newCategory,
        notes: newNotes.trim(),
      });
      setNewName('');
      setNewNotes('');
      setShowAddModal(false);
      loadExercises();
    } catch (err) {
      setError(err.message || 'Failed to create exercise');
    }
  };

  const filtered = exercises
    .filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
      if (selectedCategory === '⭐ Frequently Used') {
        return matchesSearch && (ex.usage_count || 0) > 0;
      }
      const matchesCat = selectedCategory === 'All' || ex.category === selectedCategory;
      return matchesSearch && matchesCat;
    })
    .sort((a, b) => {
      if (selectedCategory === '⭐ Frequently Used') {
        return (b.usage_count || 0) - (a.usage_count || 0);
      }
      return 0;
    });

  return (
    <div className="p-4 max-w-lg mx-auto pb-28 space-y-4 safe-top">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Exercise Library</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Browse movements and view movement history</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Exercise
        </button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto py-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading exercises...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-950/40">
          No matching exercises found.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ex) => (
            <div
              key={ex.id}
              onClick={() => handleSelectExercise(ex)}
              className="w-full text-left bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-3.5 flex items-center justify-between active:scale-[0.99] transition-all group cursor-pointer shadow-sm"
            >
              <div>
                <div className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                  {ex.name}
                  {(ex.usage_count || 0) > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 rounded font-medium">
                      {ex.usage_count} {ex.usage_count === 1 ? 'session' : 'sessions'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium tracking-wide">
                    {ex.category}
                  </span>
                  {ex.notes && (
                    <span className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-[200px]">{ex.notes}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(ex);
                  }}
                  className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl transition-colors"
                  title="Edit exercise"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Exercise History Slide-up Modal */}
      <ExerciseHistoryModal
        isOpen={!!selectedExerciseForHistory}
        onClose={() => setSelectedExerciseForHistory(null)}
        exerciseId={selectedExerciseForHistory?.id}
        exerciseName={selectedExerciseForHistory?.name}
        exerciseCategory={selectedExerciseForHistory?.category}
      />

      {/* Edit Exercise Modal */}
      {editingExercise && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Exercise</h3>
              </div>
              <button
                onClick={() => setEditingExercise(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-300 text-xs rounded-xl">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Exercise Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Bulgarian Split Squat"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Muscle Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  {CATEGORIES.filter((c) => c !== 'All' && !c.includes('⭐')).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Notes / Cues (optional)</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Pin 4, bench angle 30°"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingExercise(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editName.trim()}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm active:scale-95 transition-all"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Exercise Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">New Exercise</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-300 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateExercise} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Exercise Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Bulgarian Split Squat"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Muscle Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  {CATEGORIES.filter((c) => c !== 'All' && !c.includes('⭐')).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Notes / Cues (optional)</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Pin 4, bench angle 30°"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm active:scale-95 transition-all"
                >
                  Save Exercise
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
