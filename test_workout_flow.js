const { db, initDb } = require('./server/db');

async function testWorkflow() {
  console.log('--- Testing LibSQL / Turso Integration (Async Flow) ---');

  await initDb();

  // Clean test tables
  await db.execute('DELETE FROM workouts;');
  await db.execute('DELETE FROM workout_exercises;');
  await db.execute('DELETE FROM workout_sets;');
  await db.execute('DELETE FROM templates;');
  await db.execute('DELETE FROM template_exercises;');

  // 1. Verify exercises catalog
  const exRes = await db.execute('SELECT * FROM exercises');
  console.log(`✓ Exercises in DB: ${exRes.rows.length}`);
  const bench = exRes.rows.find(e => e.name === 'Barbell Bench Press');
  const squat = exRes.rows.find(e => e.name === 'Barbell Back Squat');
  if (!bench || !squat) throw new Error('Core exercises not found');

  // 2. Create a Template
  const tplResult = await db.execute({
    sql: 'INSERT INTO templates (name, notes) VALUES (?, ?)',
    args: ['Push & Legs Test', 'Weekly routine']
  });
  const templateId = Number(tplResult.lastInsertRowid);
  await db.execute({
    sql: 'INSERT INTO template_exercises (template_id, exercise_id, order_index) VALUES (?, ?, ?)',
    args: [templateId, bench.id, 0]
  });
  await db.execute({
    sql: 'INSERT INTO template_exercises (template_id, exercise_id, order_index) VALUES (?, ?, ?)',
    args: [templateId, squat.id, 1]
  });
  console.log(`✓ Created template #${templateId} with 2 exercises (Bench Press, Back Squat)`);

  // 3. Start workout from template
  const wResult = await db.execute({
    sql: 'INSERT INTO workouts (name, started_at) VALUES (?, CURRENT_TIMESTAMP)',
    args: ['Push & Legs Test']
  });
  const workoutId = Number(wResult.lastInsertRowid);

  const we1Res = await db.execute({
    sql: 'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?)',
    args: [workoutId, bench.id, 0]
  });
  const we2Res = await db.execute({
    sql: 'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?)',
    args: [workoutId, squat.id, 1]
  });
  const we1 = Number(we1Res.lastInsertRowid);
  const we2 = Number(we2Res.lastInsertRowid);
  console.log(`✓ Started workout #${workoutId} from template with exercises #${we1} and #${we2}`);

  // 4. Log sets
  await db.execute({
    sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, ?, ?, ?, ?)',
    args: [we1, 1, 80.0, 8, 0]
  });
  await db.execute({
    sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, ?, ?, ?, ?)',
    args: [we1, 2, 82.5, 6, 0]
  });
  await db.execute({
    sql: 'INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, ?, ?, ?, ?)',
    args: [we2, 1, 100.0, 5, 0]
  });
  console.log('✓ Logged sets for Bench Press (80kg x 8, 82.5kg x 6) and Squat (100kg x 5)');

  // 5. Finish workout
  await db.execute({
    sql: 'UPDATE workouts SET completed_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [workoutId]
  });
  console.log('✓ Finished workout #1');

  // 6. Test Move History query
  const sessionsRes = await db.execute({
    sql: `
      SELECT w.id, w.name, w.completed_at, we.id AS we_id
      FROM workouts w
      JOIN workout_exercises we ON w.id = we.workout_id
      WHERE we.exercise_id = ? AND w.completed_at IS NOT NULL
      ORDER BY w.completed_at DESC
    `,
    args: [bench.id]
  });

  console.log(`✓ Move History Query: Found ${sessionsRes.rows.length} session(s) for ${bench.name}`);
  const benchSets = await db.execute({
    sql: 'SELECT * FROM workout_sets WHERE workout_exercise_id = ?',
    args: [sessionsRes.rows[0].we_id]
  });
  benchSets.rows.forEach(s => console.log(`   Set ${s.set_number}: ${s.weight}kg x ${s.reps}`));

  // 7. Verify Popular Lifts query
  const popularLiftsRes = await db.execute(`
    SELECT e.name, COUNT(DISTINCT we.workout_id) AS usage_count
    FROM exercises e
    JOIN workout_exercises we ON e.id = we.exercise_id
    JOIN workouts w ON we.workout_id = w.id
    WHERE w.completed_at IS NOT NULL
    GROUP BY e.id
    ORDER BY usage_count DESC
  `);

  console.log('✓ Popular lifts ranking:');
  popularLiftsRes.rows.forEach(l => console.log(`   ${l.name}: ${l.usage_count} workout(s)`));

  // Clean test workout so user starts fresh
  await db.execute('DELETE FROM workouts;');
  await db.execute('DELETE FROM workout_exercises;');
  await db.execute('DELETE FROM workout_sets;');
  await db.execute('DELETE FROM templates;');
  await db.execute('DELETE FROM template_exercises;');
  console.log('✓ Cleaned test data');

  console.log('--- ALL LIBSQL / TURSO INTEGRATION TESTS PASSED ---');
}

testWorkflow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
