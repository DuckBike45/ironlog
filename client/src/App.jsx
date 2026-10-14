import React, { useState, useEffect } from 'react';
import { Dumbbell, Play, History, Sparkles, CheckCircle2, Plus, Settings, Users, LogOut } from 'lucide-react';
import { api } from './api';
import ActiveWorkout from './components/ActiveWorkout';
import WorkoutHistory from './components/WorkoutHistory';
import ExerciseLibrary from './components/ExerciseLibrary';
import Navigation from './components/Navigation';
import TemplateManager from './components/TemplateManager';
import PinEntry from './components/PinEntry';
import ProfileSelector from './components/ProfileSelector';

export default function App() {
  // Auth state persisted in sessionStorage
  const [auth, setAuth] = useState(() => {
    try {
      const stored = sessionStorage.getItem('ironlog_auth');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('workout');
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workoutName, setWorkoutName] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [templates, setTemplates] = useState([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  // Theme state
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('ironlog_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#090d16');
    } else {
      document.documentElement.classList.remove('dark');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f8fafc');
    }
    localStorage.setItem('ironlog_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Sync API client user ID with auth state
  useEffect(() => {
    if (auth && auth.userId) {
      api.setUserId(auth.userId);
      checkActiveWorkout();
      loadTemplates();
    } else {
      api.setUserId(null);
      setLoading(false);
    }
  }, [auth]);

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
      } else {
        setActiveWorkout(null);
      }
    } catch (err) {
      console.error('Failed to check active workout', err);
    } finally {
      setLoading(false);
    }
  };

  // Auth Handlers
  const handlePinSuccess = ({ mode, user }) => {
    if (mode === 'demo') {
      const authData = { mode: 'demo', userId: user.id, userName: user.name };
      sessionStorage.setItem('ironlog_auth', JSON.stringify(authData));
      setAuth(authData);
    } else if (mode === 'family') {
      const authData = { mode: 'family', userId: null, userName: null };
      sessionStorage.setItem('ironlog_auth', JSON.stringify(authData));
      setAuth(authData);
    }
  };

  const handleProfileSelect = (user) => {
    const authData = { mode: 'family', userId: user.id, userName: user.name };
    sessionStorage.setItem('ironlog_auth', JSON.stringify(authData));
    setAuth(authData);
  };

  const handleSwitchProfile = () => {
    if (auth?.mode === 'demo') {
      // Exit demo mode back to PIN screen
      sessionStorage.removeItem('ironlog_auth');
      setAuth(null);
      setActiveWorkout(null);
    } else {
      // Family mode: go back to profile selection
      const authData = { mode: 'family', userId: null, userName: null };
      sessionStorage.setItem('ironlog_auth', JSON.stringify(authData));
      setAuth(authData);
      setActiveWorkout(null);
    }
  };

  const handleResetPin = () => {
    sessionStorage.removeItem('ironlog_auth');
    setAuth(null);
    setActiveWorkout(null);
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
      loadTemplates();
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

  // Auth Gates
  if (!auth) {
    return <PinEntry onSuccess={handlePinSuccess} />;
  }

  if (auth.mode === 'family' && !auth.userId) {
    return <ProfileSelector onSelect={handleProfileSelect} onSwitchPin={handleResetPin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 z-50 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-emerald-600 text-white font-semibold text-xs py-2.5 px-4 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-400">
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Demo Banner */}
      {auth.mode === 'demo' && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-300">
          <span className="font-medium">Demo Sandbox Mode (Isolated)</span>
          <button
            onClick={handleResetPin}
            className="underline hover:text-amber-600 dark:hover:text-amber-200 font-semibold ml-2"
          >
            Exit Demo
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1">
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
                  <div className="p-4 max-w-lg mx-auto pb-28 space-y-5 safe-top">
                    {/* App Hero */}
                    <div className="text-center space-y-1.5 pt-2">
                      <div className="w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto shadow-inner">
                        <Dumbbell className="w-7 h-7" />
                      </div>
                      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">IronLog Tracker</h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                        Logged in as <span className="font-semibold text-slate-700 dark:text-slate-200">{auth.userName}</span>
                      </p>
                    </div>

                    {/* SECTION: Workout Templates */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <span>Workout Templates</span>
                        </div>
                        <button
                          onClick={() => setShowTemplateManager(true)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-xl flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          Manage Templates
                        </button>
                      </div>

                      {templates.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-5 text-center space-y-2 shadow-sm">
                          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                            No workout templates created yet. Set up standard routines (e.g. "Push Day", "Pull Day") so you don't have to add exercises every workout.
                          </p>
                          <button
                            onClick={() => setShowTemplateManager(true)}
                            className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-sm"
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
                              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-4 shadow-sm space-y-2.5"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{tpl.name}</h3>
                                  {tpl.notes && <p className="text-xs text-slate-500 dark:text-slate-400">{tpl.notes}</p>}
                                </div>
                                <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-950 rounded-lg">
                                  {tpl.exercises?.length || 0} lifts
                                </span>
                              </div>

                              {/* Exercises Preview Tags */}
                              {tpl.exercises && tpl.exercises.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {tpl.exercises.map((e, idx) => (
                                    <span
                                      key={e.id || idx}
                                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-[11px] text-slate-600 dark:text-slate-300 font-medium"
                                    >
                                      {e.exercise_name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => handleStartFromTemplate(tpl.id)}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
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
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Or Start Blank Workout
                      </div>
                      <form onSubmit={handleStartWorkout} className="space-y-3">
                        <input
                          type="text"
                          value={workoutName}
                          onChange={(e) => setWorkoutName(e.target.value)}
                          placeholder="Workout Name (e.g. Free Session)..."
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="submit"
                          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <Play className="w-3.5 h-3.5 fill-current text-blue-500" />
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
        userName={auth?.userName}
        onSwitchProfile={handleSwitchProfile}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}
