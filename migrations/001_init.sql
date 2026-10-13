PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  preferred_unit TEXT NOT NULL DEFAULT 'lb' CHECK (preferred_unit IN ('lb','kg')),
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE admin_users (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  primary_muscle TEXT,
  equipment TEXT,
  instructions TEXT,
  image_path TEXT,
  video_path TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX exercises_name_uq ON exercises(name COLLATE NOCASE);
CREATE INDEX exercises_cat_name ON exercises(category, name);

CREATE TABLE workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (id, user_id)
);

CREATE TABLE workout_exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (workout_id, user_id) REFERENCES workouts(id, user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id)
);

CREATE TABLE workout_sets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workout_exercise_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  target_reps INTEGER CHECK (target_reps IS NULL OR target_reps >= 0),
  target_weight_kg REAL CHECK (target_weight_kg IS NULL OR target_weight_kg >= 0),
  target_duration_sec INTEGER CHECK (target_duration_sec IS NULL OR target_duration_sec >= 0),
  target_rest_sec INTEGER CHECK (target_rest_sec IS NULL OR target_rest_sec >= 0),
  FOREIGN KEY (workout_exercise_id, user_id) REFERENCES workout_exercises(id, user_id) ON DELETE CASCADE,
  CHECK (target_reps IS NOT NULL OR target_weight_kg IS NOT NULL OR target_duration_sec IS NOT NULL)
);

CREATE TABLE programs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_weeks INTEGER NOT NULL DEFAULT 8 CHECK (default_weeks BETWEEN 1 AND 52),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (id, user_id)
);

CREATE TABLE program_workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  iso_weekday INTEGER NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (program_id, user_id) REFERENCES programs(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (workout_id, user_id) REFERENCES workouts(id, user_id) ON DELETE RESTRICT,
  UNIQUE (id, user_id)
);

CREATE TABLE program_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  start_monday TEXT NOT NULL,
  weeks INTEGER NOT NULL CHECK (weeks BETWEEN 1 AND 52),
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (program_id, user_id) REFERENCES programs(id, user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id)
);
CREATE UNIQUE INDEX program_runs_idem ON program_runs(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE scheduled_workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  program_run_id TEXT,
  program_slot_id TEXT,
  scheduled_date TEXT NOT NULL,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (workout_id, user_id) REFERENCES workouts(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (program_run_id, user_id) REFERENCES program_runs(id, user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id)
);
CREATE UNIQUE INDEX scheduled_slot_uq ON scheduled_workouts(program_run_id, program_slot_id, scheduled_date)
  WHERE program_run_id IS NOT NULL;
CREATE INDEX scheduled_user_date ON scheduled_workouts(user_id, scheduled_date);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_workout_id TEXT,
  scheduled_workout_id TEXT,
  name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','completed','discarded')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  notes TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (id, user_id)
);
CREATE UNIQUE INDEX sessions_one_active ON sessions(user_id) WHERE status = 'active';
CREATE UNIQUE INDEX sessions_one_per_schedule ON sessions(scheduled_workout_id)
  WHERE scheduled_workout_id IS NOT NULL AND status <> 'discarded';
CREATE INDEX sessions_user_date ON sessions(user_id, started_at);

CREATE TABLE session_exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  name_snapshot TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (session_id, user_id) REFERENCES sessions(id, user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id)
);
CREATE INDEX session_exercises_idx ON session_exercises(session_id, sort_order);

CREATE TABLE session_sets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_exercise_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  target_reps INTEGER,
  target_weight_kg REAL,
  target_duration_sec INTEGER,
  actual_reps INTEGER CHECK (actual_reps IS NULL OR actual_reps >= 0),
  actual_weight_kg REAL CHECK (actual_weight_kg IS NULL OR actual_weight_kg >= 0),
  actual_duration_sec INTEGER CHECK (actual_duration_sec IS NULL OR actual_duration_sec >= 0),
  rest_sec INTEGER CHECK (rest_sec IS NULL OR rest_sec >= 0),
  rpe REAL CHECK (rpe IS NULL OR (rpe >= 0 AND rpe <= 10)),
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (session_exercise_id, user_id) REFERENCES session_exercises(id, user_id) ON DELETE CASCADE,
  CHECK (is_completed = 0 OR COALESCE(actual_reps,0) > 0 OR COALESCE(actual_duration_sec,0) > 0)
);
CREATE INDEX session_sets_idx ON session_sets(session_exercise_id, sort_order);
