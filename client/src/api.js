const BASE_URL = '/api';

let currentUserId = null;

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (currentUserId !== null && currentUserId !== undefined) {
    headers['X-User-ID'] = String(currentUserId);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = 'API request failed';
    try {
      const data = await res.json();
      errorMsg = data.error || errorMsg;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return res.json();
}

let exercisesCache = null;
let exercisesCachePromise = null;
let templatesCache = null;
let templatesCachePromise = null;
let historyCache = null;
let historyCachePromise = null;

export const api = {
  // Session & User Context
  setUserId: (id) => {
    currentUserId = id;
    // Invalidate per-user caches if user changes
    exercisesCache = null;
    templatesCache = null;
    historyCache = null;
  },

  getUserId: () => currentUserId,

  // Auth & Profile
  verifyPin: (pin) =>
    request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),

  getUsers: () => request('/users'),

  createUser: (name) =>
    request('/users', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  // Exercises (Cached in-memory for instant 0ms modal opening and live filtering)
  getExercises: async (search = '', category = '') => {
    if (!exercisesCache) {
      if (!exercisesCachePromise) {
        exercisesCachePromise = request('/exercises')
          .then((data) => {
            exercisesCache = data;
            exercisesCachePromise = null;
            return data;
          })
          .catch((err) => {
            exercisesCachePromise = null;
            throw err;
          });
      }
      await exercisesCachePromise;
    }

    let list = exercisesCache || [];
    if (category && category !== 'All') {
      list = list.filter((ex) => (ex.category || '').toLowerCase() === category.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((ex) => (ex.name || '').toLowerCase().includes(q));
    }
    return list;
  },

  invalidateExercisesCache: () => {
    exercisesCache = null;
  },

  createExercise: async (data) => {
    exercisesCache = null; // Invalidate cache
    return request('/exercises', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateExercise: async (id, data) => {
    exercisesCache = null; // Invalidate cache
    return request(`/exercises/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getLastPerformance: (exerciseId, excludeWorkoutId) => {
    const params = new URLSearchParams();
    if (excludeWorkoutId) params.append('excludeWorkoutId', excludeWorkoutId);
    return request(`/exercises/${exerciseId}/last-performance?${params.toString()}`);
  },

  getExerciseHistory: (exerciseId) =>
    request(`/exercises/${exerciseId}/history`),

  // Templates (Cached in-memory for instant tab/modal load)
  getTemplates: async (forceRefresh = false) => {
    if (!forceRefresh && templatesCache) {
      return templatesCache;
    }
    if (!templatesCachePromise) {
      templatesCachePromise = request('/templates')
        .then((data) => {
          templatesCache = data;
          templatesCachePromise = null;
          return data;
        })
        .catch((err) => {
          templatesCachePromise = null;
          throw err;
        });
    }
    return templatesCachePromise;
  },

  getTemplate: (id) => request(`/templates/${id}`),

  createTemplate: async (data) => {
    templatesCache = null;
    return request('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateTemplate: async (id, data) => {
    templatesCache = null;
    return request(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteTemplate: async (id) => {
    templatesCache = null;
    return request(`/templates/${id}`, {
      method: 'DELETE',
    });
  },

  startWorkoutFromTemplate: (id) =>
    request(`/templates/${id}/start`, {
      method: 'POST',
    }),

  // Workouts
  getActiveWorkout: () => request('/workouts/active'),

  startWorkout: (name = '') =>
    request('/workouts/start', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  finishWorkout: async (id, notes = '') => {
    historyCache = null;
    return request(`/workouts/${id}/finish`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  discardWorkout: async (id) => {
    historyCache = null;
    return request(`/workouts/${id}`, {
      method: 'DELETE',
    });
  },

  updateWorkout: async (id, data) => {
    historyCache = null;
    return request(`/workouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getWorkoutHistory: async (forceRefresh = false) => {
    if (!forceRefresh && historyCache) {
      return historyCache;
    }
    if (!historyCachePromise) {
      historyCachePromise = request('/workouts')
        .then((data) => {
          historyCache = data;
          historyCachePromise = null;
          return data;
        })
        .catch((err) => {
          historyCachePromise = null;
          throw err;
        });
    }
    return historyCachePromise;
  },

  invalidateHistoryCache: () => {
    historyCache = null;
  },

  getWorkoutDetails: (id) => request(`/workouts/${id}`),

  // Workout Exercises & Sets
  addExerciseToWorkout: (workoutId, exerciseId) =>
    request(`/workouts/${workoutId}/exercises`, {
      method: 'POST',
      body: JSON.stringify({ exercise_id: exerciseId }),
    }),

  removeExerciseFromWorkout: (workoutExerciseId) =>
    request(`/workout-exercises/${workoutExerciseId}`, {
      method: 'DELETE',
    }),

  replaceWorkoutExercise: (workoutExerciseId, newExerciseId) =>
    request(`/workout-exercises/${workoutExerciseId}`, {
      method: 'PUT',
      body: JSON.stringify({ exercise_id: newExerciseId }),
    }),

  reorderWorkoutExercises: (workoutId, exerciseOrder) =>
    request(`/workouts/${workoutId}/exercises/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ exercise_order: exerciseOrder }),
    }),

  addSet: (workoutExerciseId, setData) =>
    request(`/workout-exercises/${workoutExerciseId}/sets`, {
      method: 'POST',
      body: JSON.stringify(setData),
    }),

  updateSet: (setId, setData) =>
    request(`/sets/${setId}`, {
      method: 'PUT',
      body: JSON.stringify(setData),
    }),

  toggleSetComplete: (setId) =>
    request(`/sets/${setId}/toggle-complete`, {
      method: 'POST',
    }),

  deleteSet: (setId) =>
    request(`/sets/${setId}`, {
      method: 'DELETE',
    }),
};
