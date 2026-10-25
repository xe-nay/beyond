# Import format

Beyond imports one JSON file (or a reply pasted from an AI chat) with dated plans and past workouts. In the app: Train → Import → **Copy the guide**, paste it into any AI chat, describe your plan or your past workouts with their dates, copy the reply and tap **Paste**.

Imports only add. A day that already has a workout of the same type asks which version to keep: yours, the import, or both. Importing the same file id again updates its entries instead of duplicating them.

The guide, as copied by the app:

```text
You are helping me write a training file for my iPhone app Beyond. Reply with ONE JSON object and nothing else, no trailing commas. The // notes below explain the fields; never put them in the file. I will save your reply as a .json file and import it.

FILE
{
  "format": "beyond-training",
  "version": 1,
  "id": "a-new-unique-id",            // new for every file, e.g. "plan-2026-11" or "history-2026-09". Reuse an old id ONLY to correct that same file: its entries are then updated instead of added.
  "name": "Short description",
  "entries": [ ... ]
}

ENTRY (one workout or one cardio session on one day)
{
  "id": "upper-a-2026-11-03",          // unique inside this file; keep it the same when correcting the file later
  "date": "2026-11-03",                // YYYY-MM-DD
  "name": "Upper A",
  "type": "strength",                  // or "cardio"
  "notes": "",
  ...strength or cardio fields below,
  "performed": { ... }                 // ONLY for workouts already done (date today or earlier). Without it the entry is a plan for that date.
}

STRENGTH FIELDS
"exercises": [
  { "name": "Bench Press", "sets": 3, "minReps": 6, "maxReps": 10, "rir": 2, "restSeconds": 150, "loadKg": 80, "warmupSets": 1, "superset": "A" }
]
- name: a common exercise name ("Squat", "Romanian Deadlift", "Lat Pulldown", "Incline Dumbbell Press"). If I gave you Beyond's exercise list, copy names exactly from it.
- sets 1–10, rir = reps in reserve (0 = failure), restSeconds 15–600, loadKg optional, superset optional (same letter = done back to back).

PERFORMED, STRENGTH (past results)
"performed": {
  "startedAt": "2026-09-14T18:00:00Z",
  "finishedAt": "2026-09-14T19:05:00Z",
  "sessionRpe": 8,                      // 1–10, how hard the whole session felt
  "sets": [
    { "name": "Bench Press", "reps": 8, "loadKg": 80, "rir": 2 },
    { "name": "Bench Press", "reps": 7, "loadKg": 80, "rir": 1 },
    { "name": "Incline Dumbbell Press", "reps": 10, "loadKg": 30, "implements": 2, "rir": 2 },
    { "name": "Squat", "reps": 5, "loadKg": 60, "warmup": true }
  ]
}
- One object per set, in the order done. Kilograms only (convert pounds: lb × 0.4536).
- Dumbbells: loadKg is the weight of ONE dumbbell; "implements": 2 when two were used.
- Barbell: loadKg is the total on the bar, bar included.
- Bodyweight moves: loadKg 0 (or the added weight).
- warmup: true for warm-up sets so they don't count toward records.

CARDIO FIELDS
"intervals": { "activityType": "Running", "warmupSeconds": 300, "workSeconds": 60, "recoverySeconds": 90, "rounds": 6, "cooldownSeconds": 300, "workCue": "4:30 /km", "recoveryCue": "Easy jog", "countdownSeconds": 5 }
- activityType: Running, Cycling, Rowing, Walking, Swimming, HIIT, Elliptical or Stairs. workSeconds is required; a steady run is 1 round with workSeconds = its length.
- workCue "M:SS /km" sets the target pace the app coaches you to.

PERFORMED, CARDIO
"performed": { "minutes": 32, "distanceKm": 6.1, "rpe": 7, "avgHr": 152 }

PAST DATES
- To record history, give each past workout its real date and a "performed" block. Dates in the future cannot have "performed".
- Several past weeks can go in one file; one entry per day and type.

WHEN IMPORTING
- An import never deletes anything. Entries are added next to what is already in the app.
- If a date already has a workout of the same type, the app asks for that day: keep mine, use the import, or keep both.

Now, from what I tell you below, write the file:
```
