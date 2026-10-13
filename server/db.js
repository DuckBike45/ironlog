const { createClient } = require('@libsql/client');
const path = require('node:path');
const fs = require('node:fs');
const { initialExercises } = require('./seedData');

// Determine database target:
// 1. If TURSO_DATABASE_URL is set -> connect to Turso cloud database
// 2. Otherwise -> fallback to local file: server/workouts.db
const isCloud = !!process.env.TURSO_DATABASE_URL;
let dbUrl = process.env.TURSO_DATABASE_URL;

if (!isCloud) {
  const localDbPath = path.join(__dirname, 'workouts.db');
  const dbDir = path.dirname(localDbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  // Convert Windows backslashes for file: protocol URI
  const normalizedPath = localDbPath.replace(/\\/g, '/');
  dbUrl = `file:${normalizedPath}`;
}

const db = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let initPromise = null;

// Helper to seed demo user and demo workout data
async function seedDemoUser() {
  try {
    // Check if demo user already exists
    const demoCheck = await db.execute('SELECT id FROM users WHERE is_demo = 1 LIMIT 1');
    let demoUserId;

    if (demoCheck.rows.length === 0) {
      const res = await db.execute({
        sql: 'INSERT INTO users (name, is_demo) VALUES (?, 1)',
        args: ['Demo Guest'],
      });
      demoUserId = Number(res.lastInsertRowid);
      console.log(`Created demo user with id ${demoUserId}`);
    } else {
      demoUserId = demoCheck.rows[0].id;
    }

    // Check if demo template exists
    const tplCheck = await db.execute({
      sql: 'SELECT id FROM templates WHERE user_id = ? AND name = ? LIMIT 1',
      args: [demoUserId, 'Full Body Starter'],
    });

    let templateId;
    if (tplCheck.rows.length === 0) {
      const tplRes = await db.execute({
        sql: 'INSERT INTO templates (name, notes, user_id) VALUES (?, ?, ?)',
        args: ['Full Body Starter', 'Foundational compound barbell lifts', demoUserId],
      });
      templateId = Number(tplRes.lastInsertRowid);

      // Find exercise IDs for Barbell Squat, Barbell Bench Press, Barbell Deadlift
      const exercisesNeeded = ['Barbell Squat', 'Barbell Bench Press', 'Barbell Deadlift'];
      for (let i = 0; i < exercisesNeeded.length; i++) {
        const exName = exercisesNeeded[i];
        const exRes = await db.execute({
          sql: 'SELECT id FROM exercises WHERE name = ? COLLATE NOCASE LIMIT 1',
          args: [exName],
        });
        if (exRes.rows.length > 0) {
          await db.execute({
            sql: 'INSERT INTO template_exercises (template_id, exercise_id, order_index) VALUES (?, ?, ?)',
            args: [templateId, exRes.rows[0].id, i],
          });
        }
      }
      console.log('Created starter template for demo user');
    }

    // Check if demo workouts exist
    const workoutCheck = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM workouts WHERE user_id = ? AND completed_at IS NOT NULL',
      args: [demoUserId],
    });

    if (Number(workoutCheck.rows[0].count) === 0) {
      // Find IDs of Squat, Bench, Deadlift
      const squatRes = await db.execute({ sql: "SELECT id FROM exercises WHERE name LIKE '%Squat%' LIMIT 1" });
      const benchRes = await db.execute({ sql: "SELECT id FROM exercises WHERE name LIKE '%Bench Press%' LIMIT 1" });
      const deadliftRes = await db.execute({ sql: "SELECT id FROM exercises WHERE name LIKE '%Deadlift%' LIMIT 1" });

      const squatId = squatRes.rows[0]?.id;
      const benchId = benchRes.rows[0]?.id;
      const deadliftId = deadliftRes.rows[0]?.id;

      // Workout 1: 14 days ago
      const w1Res = await db.execute({
        sql: `INSERT INTO workouts (name, started_at, completed_at, notes, user_id)
              VALUES ('Full Body A', datetime('now', '-14 days'), datetime('now', '-14 days', '+55 minutes'), 'Feeling solid and moving well', ?)`,
        args: [demoUserId],
      });
      const w1Id = Number(w1Res.lastInsertRowid);

      if (squatId) {
        const we = await db.execute({ sql: 'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, 0)', args: [w1Id, squatId] });
        const weId = Number(we.lastInsertRowid);
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 1, 60, 10, 1)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 2, 80, 8, 0)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 3, 80, 8, 0)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 4, 80, 8, 0)', args: [weId] });
      }

      if (benchId) {
        const we = await db.execute({ sql: 'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, 1)', args: [w1Id, benchId] });
        const weId = Number(we.lastInsertRowid);
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 1, 50, 10, 1)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 2, 70, 8, 0)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 3, 70, 7, 0)', args: [weId] });
      }

      // Workout 2: 7 days ago (Progression)
      const w2Res = await db.execute({
        sql: `INSERT INTO workouts (name, started_at, completed_at, notes, user_id)
              VALUES ('Full Body A - Progression', datetime('now', '-7 days'), datetime('now', '-7 days', '+60 minutes'), 'Great pump, weights went up smoothly', ?)`,
        args: [demoUserId],
      });
      const w2Id = Number(w2Res.lastInsertRowid);

      if (squatId) {
        const we = await db.execute({ sql: 'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, 0)', args: [w2Id, squatId] });
        const weId = Number(we.lastInsertRowid);
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 1, 60, 10, 1)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 2, 82.5, 8, 0)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 3, 82.5, 8, 0)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 4, 82.5, 8, 0)', args: [weId] });
      }

      if (benchId) {
        const we = await db.execute({ sql: 'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, 1)', args: [w2Id, benchId] });
        const weId = Number(we.lastInsertRowid);
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 1, 50, 10, 1)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 2, 72.5, 8, 0)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 3, 72.5, 8, 0)', args: [weId] });
      }

      if (deadliftId) {
        const we = await db.execute({ sql: 'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, 2)', args: [w2Id, deadliftId] });
        const weId = Number(we.lastInsertRowid);
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 1, 70, 8, 1)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 2, 100, 6, 0)', args: [weId] });
        await db.execute({ sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 3, 100, 6, 0)', args: [weId] });
      }

      console.log('Seeded demo workouts with progression data');
    }
  } catch (err) {
    console.error('Error seeding demo user:', err);
  }
}

// Initialize tables and seed starter exercises & demo user if needed
async function initDb() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Users table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          is_demo INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Exercises table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          category TEXT NOT NULL DEFAULT 'Other',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Workouts table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS workouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name TEXT,
          started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          notes TEXT
        );
      `);

      // Safely ensure user_id column exists for existing tables
      try {
        await db.execute('ALTER TABLE workouts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
      } catch (_) {
        // column already exists
      }

      // 4. Workout exercises
      await db.execute(`
        CREATE TABLE IF NOT EXISTS workout_exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
          order_index INTEGER NOT NULL DEFAULT 0,
          notes TEXT
        );
      `);

      // 5. Workout sets
      await db.execute(`
        CREATE TABLE IF NOT EXISTS workout_sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
          set_number INTEGER NOT NULL,
          weight REAL NOT NULL,
          reps INTEGER NOT NULL,
          is_warmup INTEGER NOT NULL DEFAULT 0,
          completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Templates
      await db.execute(`
        CREATE TABLE IF NOT EXISTS templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Safely ensure user_id column exists on templates
      try {
        await db.execute('ALTER TABLE templates ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
      } catch (_) {
        // column already exists
      }

      // 7. Template exercises
      await db.execute(`
        CREATE TABLE IF NOT EXISTS template_exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
          order_index INTEGER NOT NULL DEFAULT 0
        );
      `);

      // Indexes
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id);`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id);`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_we_exercise ON workout_exercises(exercise_id);`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_sets_we ON workout_sets(workout_exercise_id);`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_te_template ON template_exercises(template_id);`);

      // Seed starter catalog if empty
      const countRes = await db.execute('SELECT COUNT(*) AS count FROM exercises');
      const count = Number(countRes.rows[0].count);
      if (count === 0) {
        for (const ex of initialExercises) {
          await db.execute({
            sql: 'INSERT OR IGNORE INTO exercises (name, category, notes) VALUES (?, ?, ?)',
            args: [ex.name, ex.category, ex.notes]
          });
        }
        console.log(`Auto-seeded ${initialExercises.length} default exercises.`);
      }

      // Seed demo user and sample workouts
      await seedDemoUser();

    } catch (err) {
      console.error('Failed to initialize database tables:', err);
      throw err;
    }
  })();

  return initPromise;
}

module.exports = {
  db,
  initDb
};
