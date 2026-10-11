import React, { useState, useEffect } from 'react';
import { Search, X, Plus, Dumbbell, Check } from 'lucide-react';
import { api } from '../api';

const CATEGORIES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other'];

export default function ExerciseSelectorModal({ isOpen, onClose, onSelect }) {
  const [exercises, setExercises] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseCategory, setNewExerciseCategory] = useState('Chest');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadExercises();
      setShowCreateForm(false);
      setSearch('');
      setError('');
    }
  }, [isOpen]);

  const loadExercises = async () => {
    try {
      setLoading(true);
      const list = await api.getExercises();
      setExercises(list);
    } catch (err) {
      setError('Failed to load exercises');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExercise = async (e) => {
    e.preventDefault();
    if (!newExerciseName.trim()) return;

    try {
      setCreating(true);
      setError('');
      const created = await api.createExercise({
        name: newExerciseName.trim(),
        category: newExerciseCategory,
      });
      setNewExerciseName('');
      setShowCreateForm(false);
      onSelect(created);
    } catch (err) {
      setError(err.message || 'Failed to create exercise');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Dumbbell className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Select Exercise</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center active:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 pb-2 border-b border-slate-800/60">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercise..."
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-500"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Muscle Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto py-2.5 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Error message if any */}
        {error && (
          <div className="mx-4 mt-2 p-2.5 bg-red-500/20 border border-red-500/40 text-red-300 text-xs rounded-xl">
            {error}
          </div>
        )}

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredExercises.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400 mb-3">No matching exercise found.</p>
              {!showCreateForm && (
                <button
                  onClick={() => {
                    setShowCreateForm(true);
                    setNewExerciseName(search);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create "{search || 'New Exercise'}"
                </button>
              )}
            </div>
          )}

          {/* Frequently Used Section (when browsing all without search) */}
          {!search && selectedCategory === 'All' && exercises.some((e) => (e.usage_count || 0) > 0) && (
            <div className="space-y-2 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider px-1">
                <span>⭐ Frequently Used</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {exercises
                  .filter((e) => (e.usage_count || 0) > 0)
                  .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
                  .slice(0, 5)
                  .map((ex) => (
                    <button
                      key={`popular-${ex.id}`}
                      onClick={() => onSelect(ex)}
                      className="w-full text-left p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 active:scale-[0.99] transition-all flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-bold text-white group-hover:text-amber-300 text-sm flex items-center gap-2">
                          {ex.name}
                          <span className="text-[10px] px-1.5 py-0.2 bg-amber-400/20 text-amber-300 rounded font-normal">
                            {ex.usage_count} {ex.usage_count === 1 ? 'workout' : 'workouts'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-amber-200/70 font-semibold uppercase tracking-wider">
                            {ex.category}
                          </span>
                        </div>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 group-hover:bg-amber-500 text-amber-300 group-hover:text-slate-950 flex items-center justify-center transition-colors">
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    </button>
                  ))}
              </div>
              <div className="pt-2 border-b border-slate-800/80"></div>
            </div>
          )}

          {/* Full Exercise Catalog */}
          <div className="space-y-2">
            {!search && selectedCategory === 'All' && exercises.some((e) => (e.usage_count || 0) > 0) && (
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                All Exercises
              </div>
            )}
            {filteredExercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onSelect(ex)}
                className="w-full text-left p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 active:scale-[0.99] transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-slate-100 group-hover:text-blue-400 text-sm">
                    {ex.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-medium uppercase tracking-wider">
                      {ex.category}
                    </span>
                    {ex.notes && (
                      <span className="text-slate-500 text-xs truncate max-w-[200px]">
                        {ex.notes}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-7 h-7 rounded-full bg-slate-800/80 group-hover:bg-blue-600 text-slate-400 group-hover:text-white flex items-center justify-center transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Add Custom Exercise Bottom Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80">
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 active:bg-slate-800"
            >
              <Plus className="w-4 h-4" />
              Add Custom Exercise
            </button>
          ) : (
            <form onSubmit={handleCreateExercise} className="space-y-2">
              <div className="text-xs font-bold text-slate-300">New Custom Exercise</div>
              <input
                type="text"
                value={newExerciseName}
                onChange={(e) => setNewExerciseName(e.target.value)}
                placeholder="Exercise Name (e.g. Incline DB Fly)"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-2">
                <select
                  value={newExerciseCategory}
                  onChange={(e) => setNewExerciseCategory(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-xl px-2.5 py-2 text-xs focus:outline-none"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={creating || !newExerciseName.trim()}
                  className="flex-1 py-2 bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save & Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-2 bg-slate-800 text-slate-400 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
