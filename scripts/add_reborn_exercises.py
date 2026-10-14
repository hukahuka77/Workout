"""Add the "Reborn" exercise list to the catalog, tag them for one user, and attach
public-domain photos (free-exercise-db) where there is a genuine match.

Usage: python3 scripts/add_reborn_exercises.py <user-email> [path/to/free-exercise-db] [db] [media]
Idempotent: skips exercises that already exist (case-insensitive) and only tags them.
"""
import json, os, shutil, sqlite3, sys, uuid

EMAIL = sys.argv[1]
SRC = sys.argv[2] if len(sys.argv) > 2 else None
DB = sys.argv[3] if len(sys.argv) > 3 else "data/workout.db"
MEDIA = sys.argv[4] if len(sys.argv) > 4 else "data/media"
TAG = "Reborn"

# name, category, equipment, [muscles], cue, photo (name in free-exercise-db or None)
NEW = [
 ("Pistol Squat","Bodyweight",None,["quads","glutes","adductors"],"Single-leg squat to full depth, free leg out front. Heel flat; use a post or counterweight to assist.","Kettlebell Pistol Squat"),
 ("ATG Split Squat","Bodyweight",None,["quads","glutes","hip_flexors"],"Long stride, front knee travels well past the toes with the heel down; back knee drops to the floor. Rear foot can be elevated.",None),
 ("Cossack Squat","Bodyweight",None,["quads","glutes","adductors"],"Wide stance, shift into a deep squat on one side with the other leg straight and toes up. Chest tall, heel down.",None),
 ("L-Sit (Parallel Bars)","Bodyweight","Parallel bars",["abs","hip_flexors","triceps","front_delt"],"Press down, lock elbows, lift straight legs to horizontal. Hold for time; tuck the knees to scale.",None),
 ("Middle Split Hold","Mobility",None,["adductors","hamstrings"],"Straddle the legs wide, toes up, torso tall. Hold with slow breathing; stay out of sharp pain.",None),
 ("Pendlay Barbell Row","Strength","Barbell",["lats","upper_back","biceps","lower_back"],"Torso parallel to the floor, bar starts on the floor each rep. Row to the lower chest, return to the floor, reset.","Bent Over Barbell Row"),
 ("Dowel Shoulder Dislocate","Mobility","Dowel",["rotator_cuff","front_delt","upper_back"],"Wide grip, arms straight. Rotate the dowel over your head and behind you and back; narrow the grip as mobility improves.",None),
 ("Tibialis Raise","Bodyweight","Wall",["tibialis"],"Back against a wall, heels a step out. Lift the toes toward the shins, slow lower.",None),
 ("Wood Chop","Strength","Cable",["obliques","abs"],"Rotate through the torso with mostly straight arms, pivoting the back foot. Chop diagonally across the body.","Standing Cable Wood Chop"),
 ("Good Morning","Strength","Barbell",["hamstrings","glutes","lower_back"],"Bar on upper back, soft knees, hinge the hips back with a flat spine until the hamstrings stretch, then stand.","Good Morning"),
 ("Couch Stretch Lunge","Mobility","Couch",["quads","hip_flexors","glutes"],"Rear shin up a couch or wall, front foot forward in a lunge. Squeeze the rear glute and sink the hips.",None),
 ("Horizontal Row","Bodyweight","Bar or rings",["lats","upper_back","rear_delt","biceps"],"Body straight under a bar or rings, pull the chest to the hands, squeeze the shoulder blades.","Inverted Row"),
 ("45° Trap 3 Raise","Strength","Dumbbell",["upper_back","rear_delt"],"Chest on a 45° bench, arms in a Y at about 45°, thumbs up. Lift the arms without shrugging.",None),
 ("Chair T-Spine Rotation","Mobility","Chair",["upper_back","obliques"],"Sit tall, hands behind the head, rotate the upper back side to side without moving the hips.",None),
 ("Couch RDL","Strength","Couch",["hamstrings","glutes","lower_back"],"Single-leg Romanian deadlift with the rear foot resting on a couch. Hinge the hips back, flat spine.",None),
 ("Dumbbell B-Stance Deadlift","Strength","Dumbbell",["hamstrings","glutes","lower_back"],"Staggered stance with the back foot light on its toes. Hinge and lift; the front leg does most of the work.",None),
 ("Wall Reference Long Lunge","Bodyweight","Wall",["quads","glutes","hip_flexors"],"Back toes against a wall as a stance reference. Step long, front shin vertical, hips down.",None),
 ("Dumbbell Half-Kneeling Shoulder Press","Strength","Dumbbell",["front_delt","side_delt","triceps","abs"],"Half-kneel, squeeze the rear glute, press overhead without arching the back.",None),
 ("Deep Squat Internal Rotation","Mobility",None,["glutes","adductors"],"In a deep squat, drive one knee inward toward the opposite heel and back; alternate sides.",None),
 ("Straddle Good Morning","Strength",None,["hamstrings","adductors","lower_back"],"Wide straddle stance, hinge forward with a flat back and reach long. Add a light barbell if wanted.",None),
 ("Exorcist Curl","Strength","Dumbbell",["biceps","forearms"],"Curl variation. Add your own cues.",None),
 ("Reverse Nordic Curl","Bodyweight",None,["quads","hip_flexors"],"Kneel and lean back in a straight line from knees to head. Lower as far as control allows and return.",None),
 ("Peterson Step-Up","Bodyweight","Step",["quads"],"Small step, knee travels over the toes with the heel lifted. Control the lowering.",None),
 ("Antagonist Hamstring Stretch","Mobility",None,["hamstrings","hip_flexors"],"Lying with one leg raised, actively pull the leg toward you using hip flexors/quads while the hamstring stays relaxed.",None),
 ("Scap Retraction Pull-up","Bodyweight","Pull-up bar",["lats","upper_back"],"From a dead hang with straight arms, pull the shoulder blades down and back to lift the chest slightly, then lower.",None),
 ("Copenhagen Plank","Bodyweight","Bench",["adductors","obliques","abs"],"Side plank with the top leg on a bench; lift the hips and hold. Bend the knee to scale.",None),
 ("Deficit Push-up","Bodyweight","Plates or blocks",["chest","upper_chest","front_delt","triceps","serratus"],"Hands on raised blocks so the chest drops below hand level. Full range, body in a line.",None),
 ("QL Side Bend","Mobility","Dumbbell",["obliques","lower_back"],"Standing side bend with a light weight or bodyweight, slow, focusing on lateral flexion.",None),
 ("Elephant Walk","Mobility",None,["hamstrings","calves"],"Hands on the floor, legs straight. Alternate bending and straightening each knee to walk the stretch.",None),
 ("Active Hip Flexor Lift","Mobility",None,["hip_flexors"],"Seated, lift one leg off the floor from the hip and hold. Keep the back tall.",None),
 ("Reverse Hyperextension","Strength","Machine",["glutes","hamstrings","lower_back"],"Torso supported, swing straight legs up to hip height with control. Don't swing past the hips.","Reverse Hyperextension"),
 ("Pigeon Good Morning","Mobility",None,["glutes","hip_flexors"],"From pigeon pose, hinge the torso forward over the front shin with a long spine.",None),
 ("Incline Bench Y Raise","Strength","Dumbbell",["upper_back","side_delt","rear_delt"],"Chest on an incline bench, raise the arms overhead in a Y with thumbs up. Light weight, no shrugging.",None),
 ("Gironda Sissy Squat","Bodyweight",None,["quads","hip_flexors"],"Rise onto the toes, lean back and lower the knees forward while keeping a straight line from knees to head.","Weighted Sissy Squat"),
 ("Fist Knuckle Push-up (Wall)","Bodyweight","Wall",["forearms","chest","triceps","front_delt"],"Standing push-up against a wall on the knuckles, wrists straight. Builds wrist and knuckle tolerance.",None),
 ("Glute Ham Raise","Strength","GHD",["hamstrings","glutes","lower_back","calves"],"Locked in the GHD, lower the torso with a straight body, then curl back up using the hamstrings.","Glute Ham Raise"),
 ("Dumbbell External Rotation","Strength","Dumbbell",["rotator_cuff","rear_delt"],"Elbow at the side or lying on a side, rotate the forearm outward slowly with a light weight.","External Rotation"),
 ("Neck Bridge Isometric Hold","Bodyweight",None,["neck","upper_back"],"Gentle isometric bridge hold. Build up very gradually and stop with any neck pain or dizziness.",None),
 ("Wall Thoracic Rotation","Mobility","Wall",["upper_back","obliques"],"Side to a wall, rotate the upper back open and reach behind you, hips still.",None),
 ("Dumbbell Cross-Bench Pullover","Strength","Dumbbell",["lats","chest","serratus"],"Upper back across a bench, hips low, lower the dumbbell behind the head with soft elbows, then pull over the chest.","Bent-Arm Dumbbell Pullover"),
 ("Prone Elbow Transition","Bodyweight",None,["lower_back","abs"],"Lying face down, move between forearm and hand support with control. Add your own cues.",None),
 ("Shoulder Internal Rotation Lift-Off","Mobility",None,["rotator_cuff"],"Back of the hand against the low back; lift it away from the back and hold, without arching.",None),
 ("Bear Crawl Shoulder Tap","Bodyweight",None,["front_delt","abs","obliques","serratus"],"Hold a bear position with knees just off the floor and tap alternate shoulders without rocking the hips.",None),
 ("Banded Hip Flexor Raise","Strength","Band",["hip_flexors","abs"],"Band around the foot or knee, lift the knee against the resistance with a tall posture.",None),
 ("Hollow Body Hold","Bodyweight",None,["abs","hip_flexors"],"Lie on your back, low back pressed down, lift shoulders and straight legs off the floor. Hold for time.",None),
 ("GHD Sit-up","Bodyweight","GHD",["abs","hip_flexors"],"Locked into the GHD, lower back with control and sit all the way up. Build up reps slowly.",None),
 ("Ab Rollout","Strength","Ab wheel",["abs","lats"],"Roll out from the knees with a braced core and no sagging low back; pull back using the abs.","Ab Roller"),
 ("Quadruped Hip Abduction","Bodyweight",None,["glutes","abductors"],"On all fours, lift one knee out to the side with the hips level. Control both directions.",None),
 ("Hip Airplane","Mobility",None,["glutes","abductors","hamstrings"],"Single-leg hinge, then rotate the pelvis open and closed over the standing leg.",None),
 ("Yuri Band Routine","Mobility","Band",["rotator_cuff","rear_delt","upper_back"],"Band shoulder warm-up series (pull-aparts, dislocates, rotations). Add your own sequence.",None),
 ("Lu Raise","Strength","Dumbbell",["side_delt","front_delt","upper_back"],"Raise the arms out and up in a lateral-to-front arc with light weights, thumbs up and shoulders down.",None),
 ("Star Side Plank","Bodyweight",None,["obliques","abductors","glutes"],"Side plank with the top arm and leg lifted into a star. Hold for time.",None),
 ("Split Jump Med Ball Rotation","Strength","Medicine ball",["quads","glutes","obliques","abs"],"Explosive split jump while rotating a medicine ball from hip to hip. Land softly.",None),
 ("Downward to Upward Dog","Mobility",None,["front_delt","lower_back","hip_flexors","hamstrings"],"Flow from downward dog into upward dog with a smooth sweep, hips low, chest open.",None),
 ("Bar Dead Hang","Bodyweight","Pull-up bar",["forearms","lats"],"Hang from a bar with relaxed straight arms. Hold for time, shoulders active.",None),
 ("Superman","Bodyweight",None,["lower_back","glutes","upper_back"],"Face down, lift the arms and legs together and hold briefly. Don't crank the neck.","Superman"),
]
# existing catalog entries that map to something on the list: just tag them
EXISTING = ["Dip", "Face Pull", "World's Greatest Stretch"]

db = sqlite3.connect(DB, timeout=30)
db.execute("PRAGMA foreign_keys = ON")
user = db.execute("SELECT id FROM users WHERE email = ? COLLATE NOCASE", (EMAIL,)).fetchone()
if not user:
    sys.exit("no such user")
uid_ = user[0]
valid = {r[0] for r in db.execute("SELECT id FROM muscles")}
data = {}
if SRC:
    data = {e["name"]: e for e in json.load(open(os.path.join(SRC, "dist", "exercises.json")))}
    os.makedirs(MEDIA, exist_ok=True)

tag = db.execute("SELECT id FROM tags WHERE user_id=? AND name=?", (uid_, TAG)).fetchone()
if tag:
    tag_id = tag[0]
else:
    tag_id = str(uuid.uuid4())
    db.execute("INSERT INTO tags (id, user_id, name) VALUES (?,?,?)", (tag_id, uid_, TAG))

added = skipped = photos = 0
ids = []
for name, cat, equip, muscles, cue, photo in NEW:
    assert all(m in valid for m in muscles), (name, muscles)
    row = db.execute("SELECT id FROM exercises WHERE name = ? COLLATE NOCASE", (name,)).fetchone()
    if row:
        skipped += 1
        ids.append(row[0])
        continue
    eid = str(uuid.uuid4())
    img = None
    e = data.get(photo) if photo else None
    if e and e.get("images"):
        f = os.path.join(SRC, "exercises", e["images"][0])
        if os.path.exists(f):
            img = f"{uuid.uuid4()}.jpg"
            shutil.copyfile(f, os.path.join(MEDIA, img))
            photos += 1
    db.execute("INSERT INTO exercises (id,name,category,equipment,instructions,image_path,active) VALUES (?,?,?,?,?,?,1)", (eid, name, cat, equip, cue, img))
    for m in muscles:
        db.execute("INSERT INTO exercise_muscles (exercise_id, muscle_id) VALUES (?,?)", (eid, m))
    added += 1
    ids.append(eid)
for name in EXISTING:
    row = db.execute("SELECT id FROM exercises WHERE name = ? COLLATE NOCASE", (name,)).fetchone()
    if row:
        ids.append(row[0])
for eid in ids:
    db.execute("INSERT OR IGNORE INTO taggings (user_id, tag_id, entity_type, entity_id) VALUES (?,?, 'exercise', ?)", (uid_, tag_id, eid))
db.commit()
print(f"added {added}, already existed {skipped}, photos {photos}, tagged {len(ids)} with '{TAG}'")
