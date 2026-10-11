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

// Initialize tables and seed starter exercises if needed
async function initDb() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          category TEXT NOT NULL DEFAULT 'Other',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS workouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          notes TEXT
        );
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS workout_exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
          order_index INTEGER NOT NULL DEFAULT 0,
          notes TEXT
        );
      `);

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

      await db.execute(`
        CREATE TABLE IF NOT EXISTS templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS template_exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
          order_index INTEGER NOT NULL DEFAULT 0
        );
      `);

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
