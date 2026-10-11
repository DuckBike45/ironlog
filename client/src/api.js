const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
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

export const api = {
  // Exercises
  getExercises: (search = '', category = '') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    return request(`/exercises?${params.toString()}`);
  },

  createExercise: (data) =>
    request('/exercises', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getLastPerformance: (exerciseId, excludeWorkoutId) => {
    const params = new URLSearchParams();
    if (excludeWorkoutId) params.append('excludeWorkoutId', excludeWorkoutId);
    return request(`/exercises/${exerciseId}/last-performance?${params.toString()}`);
  },

  getExerciseHistory: (exerciseId) =>
    request(`/exercises/${exerciseId}/history`),

  // Templates
  getTemplates: () => request('/templates'),

  getTemplate: (id) => request(`/templates/${id}`),

  createTemplate: (data) =>
    request('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTemplate: (id, data) =>
    request(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id) =>
    request(`/templates/${id}`, {
      method: 'DELETE',
    }),

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

  finishWorkout: (id, notes = '') =>
    request(`/workouts/${id}/finish`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  discardWorkout: (id) =>
    request(`/workouts/${id}`, {
      method: 'DELETE',
    }),

  updateWorkout: (id, data) =>
    request(`/workouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getWorkoutHistory: () => request('/workouts'),

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

  deleteSet: (setId) =>
    request(`/sets/${setId}`, {
      method: 'DELETE',
    }),
};
