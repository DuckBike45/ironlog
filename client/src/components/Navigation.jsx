import React from 'react';
import { Dumbbell, History, BookOpen, Users, Sun, Moon } from 'lucide-react';

export default function Navigation({ activeTab, onSelectTab, isWorkoutActive, userName, onSwitchProfile, theme, onToggleTheme }) {
  const tabs = [
    {
      id: 'workout',
      label: 'Workout',
      icon: Dumbbell,
      hasBadge: isWorkoutActive,
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      hasBadge: false,
    },
    {
      id: 'exercises',
      label: 'Exercises',
      icon: BookOpen,
      hasBadge: false,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800/80 px-2 py-2 safe-area-bottom transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-between gap-1">
        <div className="grid grid-cols-3 gap-1 flex-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all active:scale-95 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  {tab.hasBadge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-950 animate-pulse" />
                  )}
                </div>
                <span className="text-[11px] mt-1">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex flex-col items-center justify-center py-2 px-2.5 rounded-2xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all active:scale-95 border-l border-slate-200 dark:border-slate-800 pl-2.5 shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400 stroke-2" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-600 stroke-2" />
            )}
            <span className="text-[10px] mt-1 text-slate-500 dark:text-slate-400 font-medium">
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>
        )}

        {/* Profile switch pill button */}
        {userName && onSwitchProfile && (
          <button
            onClick={onSwitchProfile}
            title="Switch User Profile"
            className="flex flex-col items-center justify-center py-2 px-3 rounded-2xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all active:scale-95 border-l border-slate-200 dark:border-slate-800 pl-2.5 shrink-0"
          >
            <Users className="w-5 h-5 text-slate-600 dark:text-slate-300 stroke-2" />
            <span className="text-[10px] mt-1 text-slate-600 dark:text-slate-300 truncate max-w-[55px] font-medium">
              {userName}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
