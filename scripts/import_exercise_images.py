"""Attach demo photos from the public-domain free-exercise-db to seeded exercises.

Usage: python3 scripts/import_exercise_images.py /path/to/free-exercise-db [path/to/workout.db] [path/to/media]
Only fills exercises that have no image yet. Safe to re-run.
"""
import json, os, shutil, sqlite3, sys, uuid

MAP = {
    "Barbell Bench Press": "Barbell Bench Press - Medium Grip", "Incline Dumbbell Press": "Incline Dumbbell Press",
    "Push-up": "Pushups", "Dumbbell Fly": "Dumbbell Flyes", "Cable Crossover": "Cable Crossover",
    "Overhead Press": "Seated Barbell Military Press", "Dumbbell Shoulder Press": "Dumbbell Shoulder Press",
    "Lateral Raise": "Side Lateral Raise", "Face Pull": "Face Pull", "Rear Delt Fly": "Cable Rear Delt Fly",
    "Deadlift": "Barbell Deadlift", "Romanian Deadlift": "Romanian Deadlift", "Pull-up": "Pullups", "Chin-up": "Chin-Up",
    "Lat Pulldown": "Wide-Grip Lat Pulldown", "Barbell Row": "Bent Over Barbell Row", "One-arm Dumbbell Row": "One-Arm Dumbbell Row",
    "Seated Cable Row": "Seated Cable Rows", "Back Squat": "Barbell Full Squat", "Front Squat": "Front Barbell Squat",
    "Goblet Squat": "Goblet Squat", "Bulgarian Split Squat": "Split Squat with Dumbbells", "Walking Lunge": "Barbell Walking Lunge",
    "Leg Press": "Leg Press", "Leg Extension": "Leg Extensions", "Leg Curl": "Seated Leg Curl", "Hip Thrust": "Barbell Hip Thrust",
    "Glute Bridge": "Barbell Glute Bridge", "Standing Calf Raise": "Standing Calf Raises", "Barbell Curl": "Barbell Curl",
    "Dumbbell Hammer Curl": "Hammer Curls", "Triceps Pushdown": "Triceps Pushdown", "Skull Crusher": "EZ-Bar Skullcrusher",
    "Dip": "Parallel Bar Dip", "Plank": "Plank", "Side Plank": "Side Bridge", "Hanging Leg Raise": "Hanging Leg Raise",
    "Cable Crunch": "Cable Crunch", "Dead Bug": "Dead Bug", "Farmer's Carry": "Farmer's Walk", "Cat-Cow": "Cat Stretch",
    "Child's Pose": "Child's Pose", "World's Greatest Stretch": "World's Greatest Stretch", "Hip Flexor Stretch": "Kneeling Hip Flexor",
    "Hamstring Stretch": "Hamstring Stretch", "Jump Rope": "Rope Jumping", "Rowing Machine": "Rowing, Stationary",
}

src = sys.argv[1]
db_path = sys.argv[2] if len(sys.argv) > 2 else "data/workout.db"
media = sys.argv[3] if len(sys.argv) > 3 else "data/media"
os.makedirs(media, exist_ok=True)
data = {e["name"]: e for e in json.load(open(os.path.join(src, "dist", "exercises.json")))}
db = sqlite3.connect(db_path, timeout=30)
done = 0
for mine, theirs in MAP.items():
    e = data.get(theirs)
    row = db.execute("SELECT id, image_path FROM exercises WHERE name = ? COLLATE NOCASE", (mine,)).fetchone()
    if not e or not row or row[1] or not e.get("images"):
        continue
    f = os.path.join(src, "exercises", e["images"][0])
    if not os.path.exists(f):
        continue
    name = f"{uuid.uuid4()}.jpg"
    shutil.copyfile(f, os.path.join(media, name))
    db.execute("UPDATE exercises SET image_path = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", (name, row[0]))
    done += 1
db.commit()
print(f"attached images to {done} of {len(MAP)} mapped exercises")
