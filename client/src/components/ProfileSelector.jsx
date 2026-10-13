import React, { useState, useEffect } from 'react';
import { User, Plus, Check, Loader2 } from 'lucide-react';
import { api } from '../api';

const AVATAR_COLORS = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
  'from-cyan-500 to-blue-600',
];

export default function ProfileSelector({ onSelect, onSwitchPin }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const list = await api.getUsers();
      setUsers(list);
    } catch (err) {
      setError(err.message || 'Failed to load user profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setAddingUser(true);
      setError('');
      const created = await api.createUser(newName.trim());
      setUsers((prev) => [...prev, created]);
      setNewName('');
      setShowAddForm(false);
      // Automatically select newly created user
      onSelect(created);
    } catch (err) {
      setError(err.message || 'Failed to create profile');
    } finally {
      setAddingUser(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 select-none">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Title */}
        <h1 className="text-2xl font-black tracking-wide text-white mb-2 text-center">
          Who's working out?
        </h1>
        <p className="text-xs text-slate-400 mb-8 text-center font-medium">
          Select your profile to view workouts and history
        </p>

        {error && (
          <div className="w-full p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <span className="text-xs">Loading profiles...</span>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-3">
            {/* List of profiles */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {users.map((user, idx) => {
                const colorGradient = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                const initial = user.name ? user.name.charAt(0).toUpperCase() : '?';

                return (
                  <button
                    key={user.id}
                    onClick={() => onSelect(user)}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-2 group shadow-sm"
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${colorGradient} flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-105 transition-transform`}
                    >
                      {initial}
                    </div>
                    <span className="text-sm font-semibold text-slate-200 truncate w-full text-center">
                      {user.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* If no profiles exist yet, prompt to create one */}
            {users.length === 0 && !showAddForm && (
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center mb-2">
                <p className="text-sm text-slate-400 mb-3">No profiles created yet</p>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
                >
                  Create First Profile
                </button>
              </div>
            )}

            {/* Add Person Button or Inline Form */}
            {showAddForm ? (
              <form onSubmit={handleCreateUser} className="w-full mt-2 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Profile Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Tommi, Wife..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 mb-3"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={addingUser || !newName.trim()}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {addingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewName('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              users.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full py-3.5 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-all mt-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add another profile</span>
                </button>
              )
            )}

            {/* Lock / Log out PIN button */}
            {onSwitchPin && (
              <button
                type="button"
                onClick={onSwitchPin}
                className="mt-6 text-xs text-slate-500 hover:text-slate-400 font-medium text-center transition-colors"
              >
                ← Back to PIN screen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
