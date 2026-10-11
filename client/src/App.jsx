import React, { useState, useEffect } from 'react';
import { Dumbbell, Play, History, Sparkles, CheckCircle2, Plus, Settings } from 'lucide-react';
import { api } from './api';
import ActiveWorkout from './components/ActiveWorkout';
import WorkoutHistory from './components/WorkoutHistory';
import ExerciseLibrary from './components/ExerciseLibrary';
import Navigation from './components/Navigation';
import TemplateManager from './components/TemplateManager';

export default function App() {
  const [activeTab, setActiveTab] = useState('workout');
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workoutName, setWorkoutName] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [templates, setTemplates] = useState([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  useEffect(() => {
    checkActiveWorkout();
    loadTemplates();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadTemplates = async () => {
    try {
      const list = await api.getTemplates();
      setTemplates(list);
    } catch (err) {
      console.error('Failed to load templates', err);
    }
  };

  const checkActiveWorkout = async () => {
    try {
      setLoading(true);
      const current = await api.getActiveWorkout();
      if (current) {
        setActiveWorkout(current);
        setActiveTab('workout');
      }
    } catch (err) {
      console.error('Failed to check active workout', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkout = async (e) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      const name = workoutName.trim() || `Workout - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const newWorkout = await api.startWorkout(name);
      setActiveWorkout(newWorkout);
      setWorkoutName('');
      setActiveTab('workout');
    } catch (err) {
      alert(err.message || 'Failed to start workout');
    } finally {
      setLoading(false);
    }
  };

  const handleStartFromTemplate = async (templateId) => {
    try {
      setLoading(true);
      const newWorkout = await api.startWorkoutFromTemplate(templateId);
      setActiveWorkout(newWorkout);
      showToast(`Started workout from template! 💪`);
      setActiveTab('workout');
    } catch (err) {
      alert(err.message || 'Failed to start workout from template');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkoutUpdated = (updated) => {
    setActiveWorkout(updated);
  };

  const handleFinishWorkout = async (id, notes) => {
    try {
      await api.finishWorkout(id, notes);
      setActiveWorkout(null);
      showToast('Workout finished and saved to history! 💪');
      setActiveTab('history');
      loadTemplates(); // refresh usage stats
    } catch (err) {
      alert(err.message || 'Failed to finish workout');
    }
  };

  const handleDiscardWorkout = async (id) => {
    if (!window.confirm('Are you sure you want to discard this workout? All logged sets will be lost.')) {
      return;
    }
    try {
      await api.discardWorkout(id);
      setActiveWorkout(null);
      showToast('Workout discarded');
    } catch (err) {
      alert(err.message || 'Failed to discard workout');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 z-50 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-emerald-600 text-white font-bold text-xs py-2.5 px-4 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-400">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 overflow-x-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs">Loading IronLog...</p>
          </div>
        ) : (
          <>
            {activeTab === 'workout' && (
              <>
                {activeWorkout ? (
                  <ActiveWorkout
                    workout={activeWorkout}
                    onWorkoutUpdated={handleWorkoutUpdated}
                    onFinishWorkout={handleFinishWorkout}
                    onDiscardWorkout={handleDiscardWorkout}
                  />
                ) : (
                  /* Start Workout Welcome Screen */
                  <div className="p-4 max-w-lg mx-auto pb-28 space-y-5">
                    {/* App Hero */}
                    <div className="text-center space-y-1.5 pt-2">
                      <div className="w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-500 border border-blue-500/20 flex items-center justify-center mx-auto shadow-inner">
                        <Dumbbell className="w-7 h-7" />
                      </div>
                      <h1 className="text-2xl font-black text-white tracking-tight">IronLog Tracker</h1>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        Fast, mobile-first workout tracking.
                      </p>
                    </div>

                    {/* SECTION: Workout Templates */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>Workout Templates</span>
                        </div>
                        <button
                          onClick={() => setShowTemplateManager(true)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-blue-400 text-xs font-bold rounded-xl flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          Manage Templates
                        </button>
                      </div>

                      {templates.length === 0 ? (
                        <div className="bg-slate-900 border border-dashed border-slate-800 rounded-3xl p-5 text-center space-y-2">
                          <p className="text-xs text-slate-400 max-w-xs mx-auto">
                            No workout templates created yet. Set up standard routines (e.g. "Push Day", "Pull Day") so you don't have to add exercises every workout.
                          </p>
                          <button
                            onClick={() => setShowTemplateManager(true)}
                            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-md shadow-blue-600/30"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Create Your First Template
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {templates.map((tpl) => (
                            <div
                              key={tpl.id}
                              className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-xl space-y-2.5"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="text-sm font-black text-white">{tpl.name}</h3>
                                  {tpl.notes && <p className="text-[11px] text-slate-400">{tpl.notes}</p>}
                                </div>
                                <span className="text-[11px] font-mono font-bold text-slate-400 px-2 py-0.5 bg-slate-950 rounded-lg">
                                  {tpl.exercises?.length || 0} lifts
                                </span>
                              </div>

                              {/* Exercises Preview Tags */}
                              {tpl.exercises && tpl.exercises.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {tpl.exercises.map((e, idx) => (
                                    <span
                                      key={e.id || idx}
                                      className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-300 font-medium"
                                    >
                                      {e.exercise_name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => handleStartFromTemplate(tpl.id)}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                Start {tpl.name}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SECTION: Start Blank Workout */}
                    <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-4 shadow-xl space-y-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Or Start Blank Workout
                      </div>
                      <form onSubmit={handleStartWorkout} className="space-y-3">
                        <input
                          type="text"
                          value={workoutName}
                          onChange={(e) => setWorkoutName(e.target.value)}
                          placeholder="Workout Name (e.g. Free Session)..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="submit"
                          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <Play className="w-3.5 h-3.5 fill-current text-blue-400" />
                          Start Empty Workout
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'history' && <WorkoutHistory />}
            {activeTab === 'exercises' && <ExerciseLibrary />}
          </>
        )}
      </main>

      {/* Template Manager Modal */}
      <TemplateManager
        isOpen={showTemplateManager}
        onClose={() => {
          setShowTemplateManager(false);
          loadTemplates();
        }}
        onStartTemplate={handleStartFromTemplate}
      />

      {/* Persistent Bottom Mobile Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isWorkoutActive={!!activeWorkout}
      />
    </div>
  );
}
