CREATE TABLE muscles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('upper','lower','core')),
  sort_order INTEGER NOT NULL
);

CREATE TABLE exercise_muscles (
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_id TEXT NOT NULL REFERENCES muscles(id) ON DELETE RESTRICT,
  PRIMARY KEY (exercise_id, muscle_id)
);
CREATE INDEX exercise_muscles_muscle ON exercise_muscles(muscle_id);

INSERT INTO muscles (id, name, region, sort_order) VALUES
  ('upper_chest','Upper chest','upper',1),
  ('chest','Mid/lower chest','upper',2),
  ('front_delt','Front delts','upper',3),
  ('side_delt','Side delts','upper',4),
  ('rear_delt','Rear delts','upper',5),
  ('lats','Lats','upper',6),
  ('upper_back','Upper back','upper',7),
  ('biceps','Biceps','upper',8),
  ('triceps','Triceps','upper',9),
  ('forearms','Forearms','upper',10),
  ('quads','Quads','lower',11),
  ('hamstrings','Hamstrings','lower',12),
  ('glutes','Glutes','lower',13),
  ('calves','Calves','lower',14),
  ('hip_flexors','Hip flexors','lower',15),
  ('adductors','Adductors','lower',16),
  ('abs','Abs','core',17),
  ('obliques','Obliques','core',18),
  ('lower_back','Lower back','core',19);
