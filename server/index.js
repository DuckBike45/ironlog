const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('node:path');
const { db, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Ensure database initialization runs on first request
app.use(async (req, res, next) => {
  try {
    await initDb();
    next();
  } catch (err) {
    console.error('Database initialization error:', err);
    res.status(500).json({ error: 'Database initialization failed' });
  }
});

// User identification middleware from X-User-ID header
app.use((req, res, next) => {
  const headerVal = req.headers['x-user-id'];
  req.userId = headerVal ? parseInt(headerVal, 10) || null : null;
  next();
});

// ==========================================
// 0. Auth & Users Endpoints
// ==========================================

// Verify 6-digit PIN
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }

    const familyPin = process.env.FAMILY_PIN || '123456';
    const demoPin = process.env.DEMO_PIN || '000000';

    if (String(pin).trim() === String(familyPin).trim()) {
      return res.json({ mode: 'family' });
    }

    if (String(pin).trim() === String(demoPin).trim()) {
      // Find or create demo user
      let demoUser = await db.execute('SELECT id, name FROM users WHERE is_demo = 1 LIMIT 1');
      if (demoUser.rows.length === 0) {
        const createRes = await db.execute({
          sql: 'INSERT INTO users (name, is_demo) VALUES (?, 1)',
          args: ['Demo Guest'],
        });
        const newId = Number(createRes.lastInsertRowid);
        return res.json({ mode: 'demo', user: { id: newId, name: 'Demo Guest' } });
      }
      return res.json({ mode: 'demo', user: demoUser.rows[0] });
    }

    return res.status(401).json({ error: 'Invalid PIN' });
  } catch (err) {
    console.error('Error verifying PIN:', err);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

// List profiles (excluding demo user)
app.get('/api/users', async (req, res) => {
  try {
    const result = await db.execute('SELECT id, name, created_at FROM users WHERE is_demo = 0 ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new profile
app.post('/api/users', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required' });
    }

    const trimmed = name.trim();
    const result = await db.execute({
      sql: 'INSERT INTO users (name, is_demo) VALUES (?, 0)',
      args: [trimmed],
    });

    const newUser = await db.execute({
      sql: 'SELECT id, name, created_at FROM users WHERE id = ?',
      args: [Number(result.lastInsertRowid)],
    });

    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Import historical workouts into a user profile
app.post('/api/admin/import-history', async (req, res) => {
  try {
    const { userName = 'Tommi', rows = [] } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows provided' });
    }

    // 1. Find or create user
    let userRes = await db.execute({
      sql: 'SELECT id FROM users WHERE LOWER(name) = LOWER(?) LIMIT 1',
      args: [userName.trim()],
    });

    let targetUserId;
    if (userRes.rows.length === 0) {
      const createRes = await db.execute({
        sql: 'INSERT INTO users (name, is_demo) VALUES (?, 0)',
        args: [userName.trim()],
      });
      targetUserId = Number(createRes.lastInsertRowid);
    } else {
      targetUserId = userRes.rows[0].id;
    }

    // Name mapping dictionary for common synonyms
    const nameMap = {
      'squat': 'Barbell Squat',
      'bench press': 'Barbell Bench Press',
      'deadlift': 'Barbell Deadlift',
      'pull up': 'Pull-up',
      'pull-up': 'Pull-up',
      'dumbell bicep curl': 'Dumbbell Bicep Curl',
      'dumbbell bicep curl': 'Dumbbell Bicep Curl',
    };

    // Category mapping for new exercises
    const categoryMap = {
      'Hurdle Walk': 'Legs',
      'Hang Clean': 'Back',
      'Clean': 'Back',
      'Lunges': 'Legs',
      'Abs': 'Core',
    };

    // Helper: find or create exercise
    async function getOrCreateExercise(rawName) {
      const cleanName = rawName.trim();
      const mappedName = nameMap[cleanName.toLowerCase()] || cleanName;

      const exCheck = await db.execute({
        sql: 'SELECT id, name FROM exercises WHERE LOWER(name) = LOWER(?) LIMIT 1',
        args: [mappedName],
      });

      if (exCheck.rows.length > 0) {
        return exCheck.rows[0].id;
      }

      // Check if partially matching
      const partialCheck = await db.execute({
        sql: 'SELECT id, name FROM exercises WHERE name LIKE ? LIMIT 1',
        args: [`%${cleanName}%`],
      });

      if (partialCheck.rows.length > 0) {
        return partialCheck.rows[0].id;
      }

      // Insert new exercise
      const category = categoryMap[cleanName] || 'Other';
      const insertRes = await db.execute({
        sql: 'INSERT INTO exercises (name, category, notes) VALUES (?, ?, ?)',
        args: [cleanName, category, 'Imported from RepCount'],
      });
      return Number(insertRes.lastInsertRowid);
    }

    // Group rows by Date
    const sessionsByDate = {};
    for (const r of rows) {
      if (!sessionsByDate[r.Date]) {
        sessionsByDate[r.Date] = [];
      }
      sessionsByDate[r.Date].push(r);
    }

    let workoutsCreated = 0;
    let setsCreated = 0;

    for (const [dateStr, setRows] of Object.entries(sessionsByDate)) {
      // Parse DD.MM.YYYY to ISO
      const parts = dateStr.split('.');
      let workoutDateIso;
      if (parts.length === 3) {
        const [day, month, year] = parts;
        workoutDateIso = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), 10, 0, 0)).toISOString();
      } else {
        workoutDateIso = new Date().toISOString();
      }

      const completedDateIso = new Date(new Date(workoutDateIso).getTime() + 65 * 60 * 1000).toISOString();

      // Check if workout already exists on this date for this user to avoid duplicates
      const existingWorkout = await db.execute({
        sql: "SELECT id FROM workouts WHERE user_id = ? AND started_at LIKE ? LIMIT 1",
        args: [targetUserId, `${workoutDateIso.slice(0, 10)}%`],
      });

      let workoutId;
      if (existingWorkout.rows.length > 0) {
        workoutId = existingWorkout.rows[0].id;
      } else {
        const wRes = await db.execute({
          sql: 'INSERT INTO workouts (name, started_at, completed_at, notes, user_id) VALUES (?, ?, ?, ?, ?)',
          args: [`Workout - ${dateStr}`, workoutDateIso, completedDateIso, 'Imported workout history', targetUserId],
        });
        workoutId = Number(wRes.lastInsertRowid);
        workoutsCreated++;
      }

      // Group exercises in this workout session
      // Keep track of order of exercises
      const exercisesInSession = [];
      const setsByExerciseName = {};

      for (const item of setRows) {
        const exName = item.Exercise.trim();
        if (!setsByExerciseName[exName]) {
          setsByExerciseName[exName] = [];
          exercisesInSession.push(exName);
        }
        setsByExerciseName[exName].push(item);
      }

      for (let orderIdx = 0; orderIdx < exercisesInSession.length; orderIdx++) {
        const exName = exercisesInSession[orderIdx];
        const exId = await getOrCreateExercise(exName);

        // Check if workout_exercise already exists
        let weId;
        const weCheck = await db.execute({
          sql: 'SELECT id FROM workout_exercises WHERE workout_id = ? AND exercise_id = ? LIMIT 1',
          args: [workoutId, exId],
        });

        if (weCheck.rows.length > 0) {
          weId = weCheck.rows[0].id;
        } else {
          const weRes = await db.execute({
            sql: 'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?)',
            args: [workoutId, exId, orderIdx],
          });
          weId = Number(weRes.lastInsertRowid);
        }

        const sets = setsByExerciseName[exName];
        for (let setIdx = 0; setIdx < sets.length; setIdx++) {
          const s = sets[setIdx];
          await db.execute({
            sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
            args: [
              weId,
              setIdx + 1,
              parseFloat(s.Weight) || 0,
              parseInt(s.Reps, 10) || 0,
              s.Warmup ? 1 : 0,
              workoutDateIso,
            ],
          });
          setsCreated++;
        }
      }
    }

    res.json({
      success: true,
      user_id: targetUserId,
      workoutsCreated,
      setsCreated,
      message: `Successfully imported ${workoutsCreated} workouts and ${setsCreated} sets for profile "${userName}".`,
    });
  } catch (err) {
    console.error('Error importing history:', err);
    res.status(500).json({ error: 'Failed to import history: ' + err.message });
  }
});

// ==========================================
// 1. Health Check
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// 2. Exercises Endpoints
// ==========================================

// List all exercises (with optional ?search= and ?category=)
app.get('/api/exercises', async (req, res) => {
  try {
    const { search, category } = req.query;
    const userId = req.userId;

    let query = `
      SELECT 
        e.*,
        COALESCE(usage.usage_count, 0) AS usage_count,
        usage.last_used_at
      FROM exercises e
      LEFT JOIN (
        SELECT 
          we.exercise_id,
          COUNT(DISTINCT we.workout_id) AS usage_count,
          MAX(w.completed_at) AS last_used_at
        FROM workout_exercises we
        JOIN workouts w ON we.workout_id = w.id
        WHERE w.completed_at IS NOT NULL
        ${userId ? 'AND w.user_id = ' + parseInt(userId, 10) : ''}
        GROUP BY we.exercise_id
      ) usage ON e.id = usage.exercise_id
      WHERE 1=1
    `;
    const args = [];

    if (search && search.trim() !== '') {
      query += ' AND e.name LIKE ?';
      args.push(`%${search.trim()}%`);
    }

    if (category && category !== 'All') {
      query += ' AND e.category = ?';
      args.push(category);
    }

    query += ' ORDER BY e.category ASC, e.name ASC';
    const result = await db.execute({ sql: query, args });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching exercises:', err);
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

// Create a custom exercise
app.post('/api/exercises', async (req, res) => {
  try {
    const { name, category = 'Other', notes = '' } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    const trimmedName = name.trim();
    const existing = await db.execute({
      sql: 'SELECT id FROM exercises WHERE LOWER(name) = LOWER(?)',
      args: [trimmedName],
    });

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An exercise with this name already exists' });
    }

    const result = await db.execute({
      sql: 'INSERT INTO exercises (name, category, notes) VALUES (?, ?, ?)',
      args: [trimmedName, category, notes.trim()],
    });

    const newExercise = await db.execute({
      sql: 'SELECT * FROM exercises WHERE id = ?',
      args: [Number(result.lastInsertRowid)],
    });

    res.status(201).json(newExercise.rows[0]);
  } catch (err) {
    console.error('Error creating exercise:', err);
    res.status(500).json({ error: 'Failed to create exercise' });
  }
});

// Update an exercise (e.g. change category, rename, notes)
app.put('/api/exercises/:id', async (req, res) => {
  try {
    const exerciseId = parseInt(req.params.id, 10);
    const { name, category, notes } = req.body;

    const exCheck = await db.execute({
      sql: 'SELECT * FROM exercises WHERE id = ?',
      args: [exerciseId],
    });

    if (exCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({ error: 'Exercise name cannot be empty' });
    }

    // If renaming, ensure name uniqueness
    if (name && name.trim().toLowerCase() !== exCheck.rows[0].name.toLowerCase()) {
      const nameCheck = await db.execute({
        sql: 'SELECT id FROM exercises WHERE LOWER(name) = LOWER(?) AND id != ?',
        args: [name.trim(), exerciseId],
      });
      if (nameCheck.rows.length > 0) {
        return res.status(400).json({ error: 'An exercise with this name already exists' });
      }
    }

    const current = exCheck.rows[0];
    const updatedName = name !== undefined ? name.trim() : current.name;
    const updatedCategory = category !== undefined ? category.trim() : current.category;
    const updatedNotes = notes !== undefined ? notes.trim() : current.notes;

    await db.execute({
      sql: 'UPDATE exercises SET name = ?, category = ?, notes = ? WHERE id = ?',
      args: [updatedName, updatedCategory, updatedNotes, exerciseId],
    });

    const updated = await db.execute({
      sql: 'SELECT * FROM exercises WHERE id = ?',
      args: [exerciseId],
    });

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error updating exercise:', err);
    res.status(500).json({ error: 'Failed to update exercise' });
  }
});

// Get previous performance for an exercise
app.get('/api/exercises/:id/last-performance', async (req, res) => {
  try {
    const exerciseId = parseInt(req.params.id, 10);
    const excludeWorkoutId = req.query.excludeWorkoutId ? parseInt(req.query.excludeWorkoutId, 10) : null;
    const userId = req.userId;

    let workoutQuery = `
      SELECT w.id, w.name, w.completed_at
      FROM workouts w
      JOIN workout_exercises we ON w.id = we.workout_id
      WHERE we.exercise_id = ? AND w.completed_at IS NOT NULL
    `;
    const workoutArgs = [exerciseId];

    if (userId) {
      workoutQuery += ' AND w.user_id = ?';
      workoutArgs.push(userId);
    }

    if (excludeWorkoutId) {
      workoutQuery += ' AND w.id != ?';
      workoutArgs.push(excludeWorkoutId);
    }

    workoutQuery += ' ORDER BY w.completed_at DESC LIMIT 1';
    const lastWorkoutRes = await db.execute({ sql: workoutQuery, args: workoutArgs });

    if (lastWorkoutRes.rows.length === 0) {
      return res.json({ found: false, sets: [], workout: null });
    }

    const lastWorkout = lastWorkoutRes.rows[0];

    const setsRes = await db.execute({
      sql: `
        SELECT ws.id, ws.set_number, ws.weight, ws.reps, ws.is_warmup, ws.completed_at, ws.notes
        FROM workout_sets ws
        JOIN workout_exercises we ON ws.workout_exercise_id = we.id
        WHERE we.workout_id = ? AND we.exercise_id = ?
        ORDER BY ws.set_number ASC
      `,
      args: [lastWorkout.id, exerciseId],
    });

    res.json({
      found: true,
      workout: lastWorkout,
      sets: setsRes.rows,
    });
  } catch (err) {
    console.error('Error fetching last performance:', err);
    res.status(500).json({ error: 'Failed to fetch last performance' });
  }
});

// Get full chronological history for a specific exercise
app.get('/api/exercises/:id/history', async (req, res) => {
  try {
    const exerciseId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const exRes = await db.execute({ sql: 'SELECT * FROM exercises WHERE id = ?', args: [exerciseId] });
    if (exRes.rows.length === 0) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    let historySql = `
      SELECT 
        w.id AS workout_id,
        w.name AS workout_name,
        w.started_at,
        w.completed_at,
        we.id AS workout_exercise_id
      FROM workouts w
      JOIN workout_exercises we ON w.id = we.workout_id
      WHERE we.exercise_id = ? AND w.completed_at IS NOT NULL
    `;
    const historyArgs = [exerciseId];

    if (userId) {
      historySql += ' AND w.user_id = ?';
      historyArgs.push(userId);
    }

    historySql += ' ORDER BY w.completed_at DESC';

    const sessionsRes = await db.execute({
      sql: historySql,
      args: historyArgs,
    });

    const sessions = [];
    for (const s of sessionsRes.rows) {
      const setsRes = await db.execute({
        sql: `
          SELECT id, set_number, weight, reps, is_warmup, completed_at, notes
          FROM workout_sets
          WHERE workout_exercise_id = ?
          ORDER BY set_number ASC
        `,
        args: [s.workout_exercise_id],
      });

      sessions.push({
        workout_id: s.workout_id,
        workout_name: s.workout_name,
        started_at: s.started_at,
        completed_at: s.completed_at,
        sets: setsRes.rows,
      });
    }

    res.json({
      exercise: exRes.rows[0],
      total_sessions: sessions.length,
      sessions,
    });
  } catch (err) {
    console.error('Error fetching exercise history:', err);
    res.status(500).json({ error: 'Failed to fetch exercise history' });
  }
});

// ==========================================
// 3. Workouts Endpoints
// ==========================================

// Get currently active workout (completed_at IS NULL)
app.get('/api/workouts/active', async (req, res) => {
  try {
    const userId = req.userId;
    let sql = 'SELECT * FROM workouts WHERE completed_at IS NULL';
    const args = [];

    if (userId) {
      sql += ' AND user_id = ?';
      args.push(userId);
    }

    sql += ' ORDER BY started_at DESC LIMIT 1';
    const activeRes = await db.execute({ sql, args });

    if (activeRes.rows.length === 0) {
      return res.json(null);
    }

    const fullWorkout = await getFullWorkoutDetails(activeRes.rows[0].id);
    res.json(fullWorkout);
  } catch (err) {
    console.error('Error fetching active workout:', err);
    res.status(500).json({ error: 'Failed to fetch active workout' });
  }
});

// Start a new workout
app.post('/api/workouts/start', async (req, res) => {
  try {
    const { name = '' } = req.body;
    const userId = req.userId;

    let existingSql = 'SELECT id FROM workouts WHERE completed_at IS NULL';
    const existingArgs = [];
    if (userId) {
      existingSql += ' AND user_id = ?';
      existingArgs.push(userId);
    }
    existingSql += ' LIMIT 1';

    const existing = await db.execute({ sql: existingSql, args: existingArgs });
    if (existing.rows.length > 0) {
      const full = await getFullWorkoutDetails(existing.rows[0].id);
      return res.json(full);
    }

    const defaultName = name.trim() || `Workout - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const nowIso = new Date().toISOString();
    const result = await db.execute({
      sql: 'INSERT INTO workouts (name, started_at, user_id) VALUES (?, ?, ?)',
      args: [defaultName, nowIso, userId || null],
    });

    const workout = await getFullWorkoutDetails(Number(result.lastInsertRowid));
    res.status(201).json(workout);
  } catch (err) {
    console.error('Error starting workout:', err);
    res.status(500).json({ error: 'Failed to start workout' });
  }
});

// Finish a workout
app.post('/api/workouts/:id/finish', async (req, res) => {
  try {
    const workoutId = parseInt(req.params.id, 10);
    const { notes } = req.body;

    let query = 'UPDATE workouts SET completed_at = CURRENT_TIMESTAMP';
    const args = [];

    if (typeof notes === 'string') {
      query += ', notes = ?';
      args.push(notes.trim());
    }

    query += ' WHERE id = ?';
    args.push(workoutId);

    await db.execute({ sql: query, args });
    const workout = await getFullWorkoutDetails(workoutId);
    res.json(workout);
  } catch (err) {
    console.error('Error finishing workout:', err);
    res.status(500).json({ error: 'Failed to finish workout' });
  }
});

// Discard / delete a workout
app.delete('/api/workouts/:id', async (req, res) => {
  try {
    const workoutId = parseInt(req.params.id, 10);
    await db.execute({ sql: 'DELETE FROM workouts WHERE id = ?', args: [workoutId] });
    res.json({ success: true, message: 'Workout deleted' });
  } catch (err) {
    console.error('Error deleting workout:', err);
    res.status(500).json({ error: 'Failed to delete workout' });
  }
});

// Update workout details (name, notes)
app.put('/api/workouts/:id', async (req, res) => {
  try {
    const workoutId = parseInt(req.params.id, 10);
    const { name, notes } = req.body;

    if (name !== undefined) {
      await db.execute({ sql: 'UPDATE workouts SET name = ? WHERE id = ?', args: [name.trim(), workoutId] });
    }
    if (notes !== undefined) {
      await db.execute({ sql: 'UPDATE workouts SET notes = ? WHERE id = ?', args: [notes.trim(), workoutId] });
    }

    const workout = await getFullWorkoutDetails(workoutId);
    res.json(workout);
  } catch (err) {
    console.error('Error updating workout:', err);
    res.status(500).json({ error: 'Failed to update workout' });
  }
});

// List completed workouts history
app.get('/api/workouts', async (req, res) => {
  try {
    const userId = req.userId;
    let query = `
      SELECT 
        w.id,
        w.name,
        w.started_at,
        w.completed_at,
        w.notes,
        ROUND((JULIANDAY(w.completed_at) - JULIANDAY(w.started_at)) * 24 * 60) AS duration_minutes,
        COUNT(DISTINCT we.id) AS total_exercises,
        COUNT(ws.id) AS total_sets,
        COALESCE(SUM(ws.weight * ws.reps), 0) AS total_volume_kg
      FROM workouts w
      LEFT JOIN workout_exercises we ON w.id = we.workout_id
      LEFT JOIN workout_sets ws ON we.id = ws.workout_exercise_id
      WHERE w.completed_at IS NOT NULL
    `;
    const args = [];

    if (userId) {
      query += ' AND w.user_id = ?';
      args.push(userId);
    }

    query += `
      GROUP BY w.id
      ORDER BY w.completed_at DESC
      LIMIT 100
    `;

    const workoutsRes = await db.execute({ sql: query, args });

    const result = [];
    for (const w of workoutsRes.rows) {
      const namesRes = await db.execute({
        sql: `
          SELECT e.name
          FROM workout_exercises we
          JOIN exercises e ON we.exercise_id = e.id
          WHERE we.workout_id = ?
          ORDER BY we.order_index ASC
        `,
        args: [w.id],
      });

      result.push({
        ...w,
        exercise_names: namesRes.rows.map((r) => r.name),
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Error fetching workout history:', err);
    res.status(500).json({ error: 'Failed to fetch workout history' });
  }
});

// Get a single workout with all details
app.get('/api/workouts/:id', async (req, res) => {
  try {
    const workoutId = parseInt(req.params.id, 10);
    const workout = await getFullWorkoutDetails(workoutId);
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    res.json(workout);
  } catch (err) {
    console.error('Error fetching workout:', err);
    res.status(500).json({ error: 'Failed to fetch workout' });
  }
});

// ==========================================
// 4. Workout Exercises & Sets Endpoints
// ==========================================

// Add an exercise to a workout
app.post('/api/workouts/:id/exercises', async (req, res) => {
  try {
    const workoutId = parseInt(req.params.id, 10);
    const { exercise_id } = req.body;

    if (!exercise_id) {
      return res.status(400).json({ error: 'exercise_id is required' });
    }

    const maxOrderRes = await db.execute({
      sql: 'SELECT COALESCE(MAX(order_index), -1) AS max_order FROM workout_exercises WHERE workout_id = ?',
      args: [workoutId],
    });

    const nextOrder = (maxOrderRes.rows.length ? Number(maxOrderRes.rows[0].max_order) : -1) + 1;

    await db.execute({
      sql: 'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?)',
      args: [workoutId, exercise_id, nextOrder],
    });

    const fullWorkout = await getFullWorkoutDetails(workoutId);
    res.status(201).json(fullWorkout);
  } catch (err) {
    console.error('Error adding exercise to workout:', err);
    res.status(500).json({ error: 'Failed to add exercise to workout' });
  }
});

// Replace / swap an exercise in a workout (preserving all sets)
app.put('/api/workout-exercises/:id', async (req, res) => {
  try {
    const workoutExerciseId = parseInt(req.params.id, 10);
    const { exercise_id } = req.body;

    if (!exercise_id) {
      return res.status(400).json({ error: 'exercise_id is required' });
    }

    const weRes = await db.execute({
      sql: 'SELECT workout_id FROM workout_exercises WHERE id = ?',
      args: [workoutExerciseId],
    });

    if (weRes.rows.length === 0) {
      return res.status(404).json({ error: 'Workout exercise not found' });
    }

    const workoutId = weRes.rows[0].workout_id;

    // Verify target exercise exists
    const exCheck = await db.execute({
      sql: 'SELECT id FROM exercises WHERE id = ?',
      args: [parseInt(exercise_id, 10)],
    });

    if (exCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Replacement exercise not found' });
    }

    await db.execute({
      sql: 'UPDATE workout_exercises SET exercise_id = ? WHERE id = ?',
      args: [parseInt(exercise_id, 10), workoutExerciseId],
    });

    const fullWorkout = await getFullWorkoutDetails(workoutId);
    res.json(fullWorkout);
  } catch (err) {
    console.error('Error replacing workout exercise:', err);
    res.status(500).json({ error: 'Failed to replace exercise' });
  }
});

// Remove an exercise from a workout
app.delete('/api/workout-exercises/:id', async (req, res) => {
  try {
    const workoutExerciseId = parseInt(req.params.id, 10);
    const weRes = await db.execute({
      sql: 'SELECT workout_id FROM workout_exercises WHERE id = ?',
      args: [workoutExerciseId],
    });

    if (weRes.rows.length === 0) {
      return res.status(404).json({ error: 'Workout exercise not found' });
    }

    const workoutId = weRes.rows[0].workout_id;
    await db.execute({ sql: 'DELETE FROM workout_exercises WHERE id = ?', args: [workoutExerciseId] });

    const fullWorkout = await getFullWorkoutDetails(workoutId);
    res.json(fullWorkout);
  } catch (err) {
    console.error('Error removing exercise from workout:', err);
    res.status(500).json({ error: 'Failed to remove exercise' });
  }
});

// Add a set to a workout exercise
app.post('/api/workout-exercises/:id/sets', async (req, res) => {
  try {
    const workoutExerciseId = parseInt(req.params.id, 10);
    const { weight, reps, is_warmup = 0, notes = null } = req.body;

    if (weight === undefined || reps === undefined) {
      return res.status(400).json({ error: 'Weight and reps are required' });
    }

    const maxSetRes = await db.execute({
      sql: 'SELECT COALESCE(MAX(set_number), 0) AS max_set FROM workout_sets WHERE workout_exercise_id = ?',
      args: [workoutExerciseId],
    });
    const nextSetNumber = (maxSetRes.rows.length ? Number(maxSetRes.rows[0].max_set) : 0) + 1;

    const insertRes = await db.execute({
      sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup, notes) VALUES (?, ?, ?, ?, ?, ?)',
      args: [workoutExerciseId, nextSetNumber, parseFloat(weight), parseInt(reps, 10), is_warmup ? 1 : 0, notes ? notes.trim() : null],
    });

    const newSetRes = await db.execute({
      sql: 'SELECT * FROM workout_sets WHERE id = ?',
      args: [Number(insertRes.lastInsertRowid)],
    });

    const weRes = await db.execute({
      sql: 'SELECT workout_id FROM workout_exercises WHERE id = ?',
      args: [workoutExerciseId],
    });

    const workout = await getFullWorkoutDetails(weRes.rows[0].workout_id);

    res.status(201).json({
      set: newSetRes.rows[0],
      workout,
    });
  } catch (err) {
    console.error('Error adding set:', err);
    res.status(500).json({ error: 'Failed to add set' });
  }
});

// Edit an existing set
app.put('/api/sets/:id', async (req, res) => {
  try {
    const setId = parseInt(req.params.id, 10);
    const { weight, reps, is_warmup, completed_at, is_completed, notes } = req.body;

    const setRes = await db.execute({ sql: 'SELECT * FROM workout_sets WHERE id = ?', args: [setId] });
    if (setRes.rows.length === 0) {
      return res.status(404).json({ error: 'Set not found' });
    }

    const currentSet = setRes.rows[0];
    const updatedWeight = weight !== undefined ? parseFloat(weight) : currentSet.weight;
    const updatedReps = reps !== undefined ? parseInt(reps, 10) : currentSet.reps;
    const updatedWarmup = is_warmup !== undefined ? (is_warmup ? 1 : 0) : currentSet.is_warmup;
    const updatedNotes = notes !== undefined ? (notes ? notes.trim() : null) : currentSet.notes;

    let updatedCompletedAt = currentSet.completed_at;
    if (is_completed !== undefined) {
      updatedCompletedAt = is_completed ? (completed_at || new Date().toISOString()) : null;
    } else if (completed_at !== undefined) {
      updatedCompletedAt = completed_at;
    }

    await db.execute({
      sql: 'UPDATE workout_sets SET weight = ?, reps = ?, is_warmup = ?, completed_at = ?, notes = ? WHERE id = ?',
      args: [updatedWeight, updatedReps, updatedWarmup, updatedCompletedAt, updatedNotes, setId],
    });

    const weRes = await db.execute({
      sql: 'SELECT workout_id FROM workout_exercises WHERE id = ?',
      args: [currentSet.workout_exercise_id],
    });

    const updatedSetRes = await db.execute({ sql: 'SELECT * FROM workout_sets WHERE id = ?', args: [setId] });
    const workout = await getFullWorkoutDetails(weRes.rows[0].workout_id);

    res.json({
      set: updatedSetRes.rows[0],
      workout,
    });
  } catch (err) {
    console.error('Error updating set:', err);
    res.status(500).json({ error: 'Failed to update set' });
  }
});

// Toggle completion of a set
app.post('/api/sets/:id/toggle-complete', async (req, res) => {
  try {
    const setId = parseInt(req.params.id, 10);
    const setRes = await db.execute({ sql: 'SELECT * FROM workout_sets WHERE id = ?', args: [setId] });
    if (setRes.rows.length === 0) {
      return res.status(404).json({ error: 'Set not found' });
    }

    const currentSet = setRes.rows[0];
    const nextCompletedAt = currentSet.completed_at ? null : new Date().toISOString();

    await db.execute({
      sql: 'UPDATE workout_sets SET completed_at = ? WHERE id = ?',
      args: [nextCompletedAt, setId],
    });

    const weRes = await db.execute({
      sql: 'SELECT workout_id FROM workout_exercises WHERE id = ?',
      args: [currentSet.workout_exercise_id],
    });

    const updatedSetRes = await db.execute({ sql: 'SELECT * FROM workout_sets WHERE id = ?', args: [setId] });
    const workout = await getFullWorkoutDetails(weRes.rows[0].workout_id);

    res.json({
      set: updatedSetRes.rows[0],
      workout,
    });
  } catch (err) {
    console.error('Error toggling set completion:', err);
    res.status(500).json({ error: 'Failed to toggle set completion' });
  }
});

// Delete a set and renumber remaining sets
app.delete('/api/sets/:id', async (req, res) => {
  try {
    const setId = parseInt(req.params.id, 10);
    const setRes = await db.execute({ sql: 'SELECT * FROM workout_sets WHERE id = ?', args: [setId] });
    if (setRes.rows.length === 0) {
      return res.status(404).json({ error: 'Set not found' });
    }

    const currentSet = setRes.rows[0];
    const workoutExerciseId = currentSet.workout_exercise_id;
    const weRes = await db.execute({
      sql: 'SELECT workout_id FROM workout_exercises WHERE id = ?',
      args: [workoutExerciseId],
    });

    // Delete set
    await db.execute({ sql: 'DELETE FROM workout_sets WHERE id = ?', args: [setId] });

    // Renumber remaining sets
    const remainingRes = await db.execute({
      sql: 'SELECT id FROM workout_sets WHERE workout_exercise_id = ? ORDER BY set_number ASC, id ASC',
      args: [workoutExerciseId],
    });

    for (let idx = 0; idx < remainingRes.rows.length; idx++) {
      await db.execute({
        sql: 'UPDATE workout_sets SET set_number = ? WHERE id = ?',
        args: [idx + 1, remainingRes.rows[idx].id],
      });
    }

    const workout = await getFullWorkoutDetails(weRes.rows[0].workout_id);
    res.json({
      success: true,
      workout,
    });
  } catch (err) {
    console.error('Error deleting set:', err);
    res.status(500).json({ error: 'Failed to delete set' });
  }
});

// ==========================================
// 5. Templates Endpoints
// ==========================================

// List all templates
app.get('/api/templates', async (req, res) => {
  try {
    const userId = req.userId;
    let sql = 'SELECT * FROM templates';
    const args = [];

    if (userId) {
      sql += ' WHERE user_id = ?';
      args.push(userId);
    }

    sql += ' ORDER BY created_at DESC';
    const tplRes = await db.execute({ sql, args });
    const templates = [];

    for (const t of tplRes.rows) {
      const exRes = await db.execute({
        sql: `
          SELECT 
            te.id,
            te.exercise_id,
            te.order_index,
            te.target_sets,
            te.target_reps,
            te.target_weight,
            te.sets_json,
            e.name AS exercise_name,
            e.category AS exercise_category
          FROM template_exercises te
          JOIN exercises e ON te.exercise_id = e.id
          WHERE te.template_id = ?
          ORDER BY te.order_index ASC, te.id ASC
        `,
        args: [t.id],
      });

      templates.push({
        ...t,
        exercises: exRes.rows,
      });
    }

    res.json(templates);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get a single template
app.get('/api/templates/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    const tplRes = await db.execute({ sql: 'SELECT * FROM templates WHERE id = ?', args: [templateId] });
    if (tplRes.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const exRes = await db.execute({
      sql: `
        SELECT 
          te.id,
          te.exercise_id,
          te.order_index,
          te.target_sets,
          te.target_reps,
          te.target_weight,
          te.sets_json,
          e.name AS exercise_name,
          e.category AS exercise_category
        FROM template_exercises te
        JOIN exercises e ON te.exercise_id = e.id
        WHERE te.template_id = ?
        ORDER BY te.order_index ASC, te.id ASC
      `,
      args: [templateId],
    });

    res.json({
      ...tplRes.rows[0],
      exercises: exRes.rows,
    });
  } catch (err) {
    console.error('Error fetching template:', err);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create a new template
app.post('/api/templates', async (req, res) => {
  try {
    const { name, notes = '', exercise_ids = [], exercises = [] } = req.body;
    const userId = req.userId;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const result = await db.execute({
      sql: 'INSERT INTO templates (name, notes, user_id) VALUES (?, ?, ?)',
      args: [name.trim(), notes.trim(), userId || null],
    });
    const templateId = Number(result.lastInsertRowid);

    const items = exercises.length > 0 ? exercises : exercise_ids;
    if (Array.isArray(items) && items.length > 0) {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const exerciseId = typeof item === 'object' && item !== null ? (item.exercise_id || item.id) : parseInt(item, 10);
        const targetSets = (typeof item === 'object' && item !== null && item.target_sets !== undefined && item.target_sets !== null && item.target_sets !== '')
          ? parseInt(item.target_sets, 10)
          : null;
        const targetReps = (typeof item === 'object' && item !== null && item.target_reps !== undefined && item.target_reps !== null && item.target_reps !== '')
          ? parseInt(item.target_reps, 10)
          : null;
        const targetWeight = (typeof item === 'object' && item !== null && item.target_weight !== undefined && item.target_weight !== null && item.target_weight !== '')
          ? parseFloat(item.target_weight)
          : null;
        const setsJson = (typeof item === 'object' && item !== null && Array.isArray(item.sets))
          ? JSON.stringify(item.sets)
          : (typeof item === 'object' && item !== null && item.sets_json)
            ? (typeof item.sets_json === 'string' ? item.sets_json : JSON.stringify(item.sets_json))
            : null;

        await db.execute({
          sql: 'INSERT INTO template_exercises (template_id, exercise_id, order_index, target_sets, target_reps, target_weight, sets_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [templateId, parseInt(exerciseId, 10), idx, targetSets, targetReps, targetWeight, setsJson],
        });
      }
    }

    const tplRes = await db.execute({ sql: 'SELECT * FROM templates WHERE id = ?', args: [templateId] });
    const exRes = await db.execute({
      sql: `
        SELECT 
          te.id,
          te.exercise_id,
          te.order_index,
          te.target_sets,
          te.target_reps,
          te.target_weight,
          te.sets_json,
          e.name AS exercise_name,
          e.category AS exercise_category
        FROM template_exercises te
        JOIN exercises e ON te.exercise_id = e.id
        WHERE te.template_id = ?
        ORDER BY te.order_index ASC, te.id ASC
      `,
      args: [templateId],
    });

    res.status(201).json({ ...tplRes.rows[0], exercises: exRes.rows });
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update a template
app.put('/api/templates/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    const { name, notes, exercise_ids, exercises } = req.body;

    const tplRes = await db.execute({ sql: 'SELECT id FROM templates WHERE id = ?', args: [templateId] });
    if (tplRes.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (name !== undefined) {
      await db.execute({ sql: 'UPDATE templates SET name = ? WHERE id = ?', args: [name.trim(), templateId] });
    }
    if (notes !== undefined) {
      await db.execute({ sql: 'UPDATE templates SET notes = ? WHERE id = ?', args: [notes.trim(), templateId] });
    }

    const items = exercises !== undefined ? exercises : exercise_ids;
    if (Array.isArray(items)) {
      await db.execute({ sql: 'DELETE FROM template_exercises WHERE template_id = ?', args: [templateId] });
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const exerciseId = typeof item === 'object' && item !== null ? (item.exercise_id || item.id) : parseInt(item, 10);
        const targetSets = (typeof item === 'object' && item !== null && item.target_sets !== undefined && item.target_sets !== null && item.target_sets !== '')
          ? parseInt(item.target_sets, 10)
          : null;
        const targetReps = (typeof item === 'object' && item !== null && item.target_reps !== undefined && item.target_reps !== null && item.target_reps !== '')
          ? parseInt(item.target_reps, 10)
          : null;
        const targetWeight = (typeof item === 'object' && item !== null && item.target_weight !== undefined && item.target_weight !== null && item.target_weight !== '')
          ? parseFloat(item.target_weight)
          : null;
        const setsJson = (typeof item === 'object' && item !== null && Array.isArray(item.sets))
          ? JSON.stringify(item.sets)
          : (typeof item === 'object' && item !== null && item.sets_json)
            ? (typeof item.sets_json === 'string' ? item.sets_json : JSON.stringify(item.sets_json))
            : null;

        await db.execute({
          sql: 'INSERT INTO template_exercises (template_id, exercise_id, order_index, target_sets, target_reps, target_weight, sets_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [templateId, parseInt(exerciseId, 10), idx, targetSets, targetReps, targetWeight, setsJson],
        });
      }
    }

    const updatedRes = await db.execute({ sql: 'SELECT * FROM templates WHERE id = ?', args: [templateId] });
    const exRes = await db.execute({
      sql: `
        SELECT 
          te.id,
          te.exercise_id,
          te.order_index,
          te.target_sets,
          te.target_reps,
          te.target_weight,
          te.sets_json,
          e.name AS exercise_name,
          e.category AS exercise_category
        FROM template_exercises te
        JOIN exercises e ON te.exercise_id = e.id
        WHERE te.template_id = ?
        ORDER BY te.order_index ASC, te.id ASC
      `,
      args: [templateId],
    });

    res.json({ ...updatedRes.rows[0], exercises: exRes.rows });
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete a template
app.delete('/api/templates/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    await db.execute({ sql: 'DELETE FROM templates WHERE id = ?', args: [templateId] });
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Start an active workout from a template
app.post('/api/templates/:id/start', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    const userId = req.userId;

    const tplRes = await db.execute({ sql: 'SELECT * FROM templates WHERE id = ?', args: [templateId] });
    if (tplRes.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    let existingSql = 'SELECT id FROM workouts WHERE completed_at IS NULL';
    const existingArgs = [];
    if (userId) {
      existingSql += ' AND user_id = ?';
      existingArgs.push(userId);
    }
    existingSql += ' LIMIT 1';

    const existing = await db.execute({ sql: existingSql, args: existingArgs });
    if (existing.rows.length > 0) {
      const activeWorkout = await getFullWorkoutDetails(existing.rows[0].id);
      return res.status(400).json({
        error: 'A workout is already in progress. Please finish or discard it first.',
        activeWorkout,
      });
    }

    const template = tplRes.rows[0];
    const nowIso = new Date().toISOString();
    const workoutRes = await db.execute({
      sql: 'INSERT INTO workouts (name, started_at, user_id) VALUES (?, ?, ?)',
      args: [template.name, nowIso, userId || null],
    });
    const workoutId = Number(workoutRes.lastInsertRowid);

    const teRes = await db.execute({
      sql: 'SELECT exercise_id, order_index, target_sets, target_reps, target_weight, sets_json FROM template_exercises WHERE template_id = ? ORDER BY order_index ASC',
      args: [templateId],
    });

    for (const te of teRes.rows) {
      const weResult = await db.execute({
        sql: 'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?)',
        args: [workoutId, te.exercise_id, te.order_index],
      });
      const workoutExerciseId = Number(weResult.lastInsertRowid);

      // 1. Check if sets_json has per-set baseline configuration
      let plannedSets = [];
      if (te.sets_json) {
        try {
          plannedSets = typeof te.sets_json === 'string' ? JSON.parse(te.sets_json) : te.sets_json;
        } catch (_) {}
      }

      if (Array.isArray(plannedSets) && plannedSets.length > 0) {
        for (let sIdx = 0; sIdx < plannedSets.length; sIdx++) {
          const s = plannedSets[sIdx];
          const setNumber = s.set_number || (sIdx + 1);
          const weight = (s.weight !== undefined && s.weight !== null && s.weight !== '') ? parseFloat(s.weight) : 0;
          const reps = (s.reps !== undefined && s.reps !== null && s.reps !== '') ? parseInt(s.reps, 10) : 0;
          const isWarmup = s.is_warmup ? 1 : 0;

          await db.execute({
            sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
            args: [workoutExerciseId, setNumber, weight, reps, isWarmup, null],
          });
        }
      } else {
        // Fallback for target_sets count
        const targetSetsCount = parseInt(te.target_sets, 10) || 0;
        if (targetSetsCount > 0) {
          const defaultReps = te.target_reps != null ? parseInt(te.target_reps, 10) : 0;
          const defaultWeight = te.target_weight != null ? parseFloat(te.target_weight) : 0;
          for (let setIdx = 1; setIdx <= targetSetsCount; setIdx++) {
            await db.execute({
              sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
              args: [workoutExerciseId, setIdx, defaultWeight, defaultReps, 0, null],
            });
          }
        }
      }
    }

    const fullWorkout = await getFullWorkoutDetails(workoutId);
    res.status(201).json(fullWorkout);
  } catch (err) {
    console.error('Error starting workout from template:', err);
    res.status(500).json({ error: 'Failed to start workout from template' });
  }
});

// ==========================================
// Helper: Construct full workout hierarchy
// ==========================================
async function getFullWorkoutDetails(workoutId) {
  const wRes = await db.execute({ sql: 'SELECT * FROM workouts WHERE id = ?', args: [workoutId] });
  if (wRes.rows.length === 0) return null;

  const workout = wRes.rows[0];

  const weRes = await db.execute({
    sql: `
      SELECT 
        we.id,
        we.workout_id,
        we.exercise_id,
        we.order_index,
        we.notes,
        e.name AS exercise_name,
        e.category AS exercise_category
      FROM workout_exercises we
      JOIN exercises e ON we.exercise_id = e.id
      WHERE we.workout_id = ?
      ORDER BY we.order_index ASC, we.id ASC
    `,
    args: [workoutId],
  });

  if (weRes.rows.length === 0) {
    return {
      ...workout,
      exercises: [],
    };
  }

  // Fetch all sets for all exercises in this workout in a single batch query
  const weIds = weRes.rows.map((r) => r.id);
  const placeholders = weIds.map(() => '?').join(',');
  const setsRes = await db.execute({
    sql: `SELECT * FROM workout_sets WHERE workout_exercise_id IN (${placeholders}) ORDER BY set_number ASC`,
    args: weIds,
  });

  // Group sets by workout_exercise_id
  const setsByWeId = {};
  for (const s of setsRes.rows) {
    if (!setsByWeId[s.workout_exercise_id]) {
      setsByWeId[s.workout_exercise_id] = [];
    }
    setsByWeId[s.workout_exercise_id].push(s);
  }

  const exercises = weRes.rows.map((we) => ({
    ...we,
    sets: setsByWeId[we.id] || [],
  }));

  return {
    ...workout,
    exercises,
  };
}

// Only serve static frontend files in local dev mode.
// On Vercel, the CDN edge serves client/dist — the serverless function handles /api/* only.
if (!process.env.VERCEL) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    const indexPath = path.join(clientDist, 'index.html');
    if (require('node:fs').existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.json({ message: 'IronLog API is active.' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Workout Tracker server listening on port ${PORT}`);
  });
}

module.exports = app;
