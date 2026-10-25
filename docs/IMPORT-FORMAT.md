# Beyond training import: the complete format

This guide explains every part of the file Beyond imports. It is written so you can paste it into an AI chat (ChatGPT, Gemini or any other) and then describe your training in your own words: the chat writes the file, you copy its reply and tap Paste in Beyond (Train > Import).

## Instructions for the AI writing the file

- Reply with ONE JSON object and nothing else. No comments, no trailing commas, no text before or after (a code block around it is fine).
- Follow the field names, types and ranges below exactly. Leave out a field you do not know rather than inventing a value.
- Weights in kilograms. Convert pounds: kg = lb x 0.4536, rounded to 0.5.
- RIR means "reps in reserve" (how many more reps were possible). If I give RPE instead: RIR = 10 - RPE.
- Give every entry a date in YYYY-MM-DD. If I say "last Monday" or "three weeks ago", work out the real date; if you do not know today's date, ask me before writing the file.
- Use exercise names as I say them, with the equipment when it matters ("Dumbbell Bench Press", "Cable Lateral Raise"). If I gave you Beyond's exercise list, copy names exactly from it.
- Make a new file "id" for every file, unless I ask you to correct a file you already gave me: then keep the same file id and entry ids.


## 1. How importing works

- Imports only ADD. Nothing already in the app is deleted or changed unless you choose so on a conflict.
- One file holds any number of entries. Each entry is ONE workout or ONE cardio session on ONE date.
- An entry with a "performed" block is history: a workout already done, with its sets, reps, weights and RIR. Its date must be today or earlier.
- An entry without "performed" is a plan for that date. A planned workout shows on Today as "Planned today" with a Start button, and as a ring on that day in the calendar. Planned cardio shows in the Cardio screen under "Planned", ready to start.
- The import does not create a repeating weekly program. Programs are made in the app (templates or Build my program). To plan several weeks, write one entry per workout per date.
- Before importing, the app lists every entry with its date and whether it is History or Planned. If any entry has an error, nothing is imported and the errors are listed (see section 10).
- Conflicts: when an entry falls on a date that already has a workout of the same type in the app (strength with strength, cardio with cardio), the app asks for that entry:
  - Mine: keep what is in the app, skip this entry (the default).
  - Import: use this entry and remove what the app had on that date (same type only).
  - Both: keep both.
  A workout in progress in the app is never touched.
- Importing a file with the same file "id" again: entries that did not change show "Already in" and are skipped; entries that changed ask "Keep mine" or "Use import". This is how you correct a file without duplicating it.
- Everything is stored only on the phone.


## 2. The file

    {
      "format": "beyond-training",
      "version": 1,
      "id": "history-2026-09",
      "name": "September training log",
      "entries": [ ... ]
    }

- format (required): "beyond-training". Files from the old Kinetic app ("kinetic-training") also work.
- version (required): 1.
- id (strongly recommended): any short text, unique per file, such as "plan-2026-11" or "history-2026-09". Inside the app every entry is stored as file id + entry id, so two different files never collide, and re-importing the same file updates instead of duplicating. Without an id, the file id is "import".
- name (optional): a description for you; not stored.
- entries (required): a list with at least one entry.


## 3. Every entry

    {
      "id": "push-2026-09-14",
      "date": "2026-09-14",
      "type": "strength",
      "name": "Push",
      "notes": "Felt strong",
      ...
    }

- id (required): unique inside this file. Letters, digits and dashes, such as "push-2026-09-14". Keep it the same when you correct the file later.
- date (required): YYYY-MM-DD, a real calendar date.
- type: "strength" (the default when left out) or "cardio". Anything else is an error.
- name (optional): shown in the app, such as "Upper A" or "Easy run". Strength defaults to "Imported session"; cardio to its activity.
- notes (optional): free text kept with the workout.
- performed (optional): the results; makes the entry history. Only for today or earlier.

A strength entry needs "exercises" (the plan), "performed" with "sets" (the results), or both. A cardio entry needs "intervals".


## 4. Strength plan: "exercises"

The planned exercises, in the order they are done:

    "exercises": [
      { "name": "Bench Press", "sets": 4, "minReps": 6, "maxReps": 8, "rir": 2, "restSeconds": 180, "loadKg": 80, "warmupSets": 2 },
      { "name": "Incline Dumbbell Press", "sets": 3, "minReps": 8, "maxReps": 12, "rir": 1, "restSeconds": 120, "superset": "A" },
      { "name": "Cable Fly", "sets": 3, "minReps": 12, "maxReps": 15, "rir": 1, "restSeconds": 60, "superset": "A" }
    ]

- name or exerciseId (one required): the exercise. See section 7 for how names are matched.
- sets: working sets, 1 to 10. Default 3.
- minReps: bottom of the rep range, 1 to 50. Default 8.
- maxReps: top of the rep range, from minReps to 50. Default 12, or equal to minReps when only minReps is given. For a fixed number of reps, give the same value to both.
- rir: target reps in reserve, 0 (to failure) to 5. Default 2.
- restSeconds: rest after each set, 15 to 600. Default 120. The rest timer starts with this value after every set.
- loadKg (optional): target weight (see section 6 for what the number means per equipment).
- warmupSets: warm-up sets before the working sets, 0 to 5. Default 0.
- superset (optional): a letter, "A", "B" or "C". Exercises with the same letter are done back to back.

Values outside a range are brought to the nearest allowed value. The app uses the rep range and RIR for its progression advice: when you reach the top of the range at the target RIR, it suggests adding weight.


## 5. Strength results: "performed"

    "performed": {
      "startedAt": "2026-09-14T18:00:00+02:00",
      "finishedAt": "2026-09-14T19:05:00+02:00",
      "sessionRpe": 8,
      "sets": [
        { "name": "Bench Press", "reps": 10, "loadKg": 40, "warmup": true },
        { "name": "Bench Press", "reps": 8, "loadKg": 80, "rir": 2 },
        { "name": "Bench Press", "reps": 7, "loadKg": 80, "rir": 1, "actualRestSeconds": 180 },
        { "name": "Incline Dumbbell Press", "reps": 10, "loadKg": 30, "implements": 2, "rir": 2 },
        { "name": "Pull-ups", "reps": 8, "loadKg": 0, "rir": 1 },
        { "name": "Pull-ups", "reps": 6, "loadKg": 10, "rir": 1 }
      ]
    }

- startedAt, finishedAt (optional): date and time in ISO 8601 with the time zone, as above. Defaults: 12:00 and 13:00 UTC on the entry's date (a one-hour session).
- sessionRpe (optional): how hard the whole session felt, 1 to 10.
- sets (required for results): one object per set, in the order they were done.
  - name or exerciseId (required).
  - reps (required): repetitions done.
  - loadKg: the weight (see section 6). 0 for bodyweight.
  - rir (optional): reps in reserve, 0 to 10. Leave it out if unknown.
  - warmup (optional): true for warm-up sets. Default false. Warm-ups do not count toward volume, records or fatigue.
  - implements (optional): for dumbbells and kettlebells, 1 or 2 held at once. When left out, the app decides from the exercise: 2 for two-handed dumbbell work (presses, curls, raises), 1 for one-arm, single-leg, goblet, concentration and most kettlebell moves.
  - completedAt (optional): when the set was finished, ISO 8601. Default noon on the entry's date.
  - actualRestSeconds (optional): rest taken before this set.

A history entry may have only "performed" (the usual case for past workouts) or also "exercises" (what was planned that day).

What the app does with history: personal records and estimated 1RM (Epley formula, sets of 10 reps or fewer), volume (weight x number of dumbbells x reps), strength and volume charts, the muscle map, fatigue signals (many sets near failure, falling reps at the same weight), progression advice, and the "last time" values that prefill your sets the next time you do the exercise.


## 6. What "loadKg" means per equipment

- Barbell, EZ bar, trap bar, Smith machine: the total on the bar, bar included (an Olympic bar is 20 kg).
- Dumbbells: the weight of ONE dumbbell. Say how many were used with "implements".
- Kettlebells: the weight of one kettlebell, with "implements" for two.
- Cable and machines: the number on the stack or pin. Plate-loaded machines: the plates loaded.
- Bodyweight and bands: 0, or the added weight (vest, belt). Assisted machines: 0.


## 7. Exercise names

Beyond has 1,388 exercises (RepDB and free-exercise-db). A name is matched in this order:

1. An exact exercise id (from an exported template, or old Kinetic ids like "Dumbbell_Bench_Press").
2. Common short names: Squat (Barbell Back Squat), Deadlift, Bench / Bench Press, Overhead / Military / Shoulder Press, Row / Barbell Row / Bent-over Row, Hip Thrust, Curl / Bicep Curl, Dips, Chin-ups, Pull-ups, Push-ups, Calf Raise, Lateral Raise.
3. The exact catalog name, ignoring case, spaces and punctuation.
4. Otherwise the exercise whose name holds all your words with the fewest extra words; plurals are fine, and a plain "Barbell" or "Dumbbell" is preferred when the equipment is not given.

Examples of what names become:

    Bench Press             -> Barbell Bench Press
    Incline Dumbbell Press  -> Incline Dumbbell Press
    Romanian Deadlift       -> Romanian Deadlift
    Lat Pulldown            -> Lat Pulldown
    Seated Cable Row        -> Seated Cable Row
    Lateral Raises          -> Dumbbell Lateral Raise
    Hammer Curl             -> Dumbbell Hammer Curl
    Tricep Pushdown         -> Cable Tricep Pushdown
    Face Pull               -> Cable Face Pull
    Leg Curl                -> Lying Leg Curl
    Skull Crushers          -> Skull Crusher
    Calf Raise              -> Machine Calf Raise

Be specific when the variant matters: "Dumbbell Shoulder Press", "Smith Machine Squat", "Seated Leg Curl". A name that matches nothing stops the import with an error naming it. For exact names, tap "Copy exercise names" on the Import screen and give the list to the AI.


## 8. Cardio

    {
      "id": "intervals-2026-11-04",
      "date": "2026-11-04",
      "type": "cardio",
      "name": "6 x 1 min",
      "intervals": {
        "activityType": "Running",
        "warmupSeconds": 600,
        "workSeconds": 60,
        "recoverySeconds": 90,
        "rounds": 6,
        "cooldownSeconds": 300,
        "workCue": "4:30 /km",
        "recoveryCue": "Easy jog",
        "countdownSeconds": 5
      }
    }

intervals (required for cardio):

- activityType: Running, Walking, Cycling, Rowing, Swimming, Elliptical, Stairs or HIIT. Default Running. Other text is accepted and shown as is.
- warmupSeconds: 0 or more. Default 0.
- workSeconds (required): length of each work phase, more than 0.
- recoverySeconds: rest between work phases. Default 0.
- rounds: number of work phases, 1 or more. Default 1.
- cooldownSeconds: 0 or more. Default 0.
- workCue (optional): text shown during work phases. A pace written as "M:SS /km" or "M:SS /mi" (such as "4:30 /km") is also the target pace for the voice coach.
- recoveryCue (optional): text shown during recovery phases.
- countdownSeconds: beeps before each phase change, 0 to 30. Default 5. The app plays 3, 5, 10 or 15 seconds of beeps (the nearest length below); 0 plays only the closing tone.

The timer runs: warm-up, then work and recovery for each round (no recovery after the last round), then cool-down. Planned length = warm-up + rounds x work + (rounds - 1) x recovery + cool-down. A steady session is one round: "rounds": 1 and "workSeconds" equal to its length, such as 2400 for 40 minutes.

During Running, Walking and Cycling the phone measures distance by GPS and shows the live pace. When the last 30 seconds reach the target pace of the workCue (within 3 %), a voice says "You're on pace", once per work phase.

performed for cardio (history):

    "performed": { "minutes": 42, "distanceKm": 8.2, "rpe": 7, "avgHr": 152 }

- minutes: duration. Default: the planned length.
- distanceKm (optional): distance in kilometres (miles x 1.609).
- rpe (optional): effort 1 to 10.
- avgHr (optional): average heart rate in beats per minute.

Calories for cardio are estimated from the activity (MET values) and your body weight when one is logged.


## 9. Correcting and re-importing

- To fix a file: change it, keep the same file "id" and entry "id"s, import again, and choose "Use import" for the entries you changed.
- To add more history later: write a NEW file with a new id. Earlier imports stay as they are.
- Two workouts of the same type on one day are possible: give them different entry ids; if the app already has one that day, choose "Both".
- Program > Share exports your current program as a one-week file in this format, ready to edit and import as plans.


## 10. Error messages

If any entry has a problem, nothing is imported and the first errors are shown:

- "The file is not valid JSON." The reply has comments, trailing commas or missing quotes.
- "Unknown format. Expected "beyond-training", version 1." Check "format" and "version".
- "The file has no entries." "entries" is missing or empty.
- "Entry N: missing or duplicate id." Every entry needs its own "id".
- "Entry N: date must be YYYY-MM-DD." Use a real date such as 2026-09-14.
- "Entry N: type must be "strength" or "cardio"."
- "Entry N: a future date cannot have results." Remove "performed" or fix the date.
- "Entry N: a workout needs "exercises" or performed "sets"."
- "Entry N: unknown exercise "X"." / "a performed set names an unknown exercise." Rename it (see section 7).
- "Entry N: cardio needs workSeconds."
- "Entry N: already in progress in the app." Finish or discard that workout first.


## 11. Complete example

One file with two past workouts, one past run, one planned workout and one planned interval session:

    {
      "format": "beyond-training",
      "version": 1,
      "id": "example-2026-10",
      "name": "Example",
      "entries": [
        {
          "id": "push-2026-10-13", "date": "2026-10-13", "type": "strength", "name": "Push",
          "performed": {
            "startedAt": "2026-10-13T18:00:00+02:00", "finishedAt": "2026-10-13T19:10:00+02:00", "sessionRpe": 8,
            "sets": [
              { "name": "Bench Press", "reps": 10, "loadKg": 40, "warmup": true },
              { "name": "Bench Press", "reps": 8, "loadKg": 80, "rir": 2 },
              { "name": "Bench Press", "reps": 8, "loadKg": 80, "rir": 1 },
              { "name": "Bench Press", "reps": 7, "loadKg": 80, "rir": 0 },
              { "name": "Dumbbell Shoulder Press", "reps": 10, "loadKg": 24, "implements": 2, "rir": 2 },
              { "name": "Dumbbell Shoulder Press", "reps": 9, "loadKg": 24, "implements": 2, "rir": 1 },
              { "name": "Lateral Raises", "reps": 15, "loadKg": 10, "rir": 1 },
              { "name": "Tricep Pushdown", "reps": 12, "loadKg": 35, "rir": 1 }
            ]
          }
        },
        {
          "id": "legs-2026-10-15", "date": "2026-10-15", "type": "strength", "name": "Legs",
          "performed": {
            "sessionRpe": 9,
            "sets": [
              { "name": "Squat", "reps": 5, "loadKg": 120, "rir": 2 },
              { "name": "Squat", "reps": 5, "loadKg": 120, "rir": 1 },
              { "name": "Romanian Deadlift", "reps": 8, "loadKg": 100, "rir": 2 },
              { "name": "Leg Curl", "reps": 12, "loadKg": 45, "rir": 1 },
              { "name": "Bulgarian Split Squat", "reps": 10, "loadKg": 16, "implements": 2, "rir": 2 }
            ]
          }
        },
        {
          "id": "run-2026-10-16", "date": "2026-10-16", "type": "cardio", "name": "Easy run",
          "intervals": { "activityType": "Running", "workSeconds": 2400, "rounds": 1, "workCue": "6:00 /km" },
          "performed": { "minutes": 41, "distanceKm": 6.9, "rpe": 5, "avgHr": 141 }
        },
        {
          "id": "pull-2026-11-03", "date": "2026-11-03", "type": "strength", "name": "Pull",
          "exercises": [
            { "name": "Pull-ups", "sets": 4, "minReps": 6, "maxReps": 10, "rir": 1, "restSeconds": 150, "warmupSets": 1 },
            { "name": "Barbell Row", "sets": 3, "minReps": 8, "maxReps": 10, "rir": 2, "restSeconds": 120, "loadKg": 70 },
            { "name": "Face Pull", "sets": 3, "minReps": 12, "maxReps": 15, "rir": 1, "restSeconds": 60, "superset": "A" },
            { "name": "Hammer Curl", "sets": 3, "minReps": 10, "maxReps": 12, "rir": 1, "restSeconds": 60, "superset": "A" }
          ]
        },
        {
          "id": "intervals-2026-11-04", "date": "2026-11-04", "type": "cardio", "name": "6 x 1 min",
          "intervals": {
            "activityType": "Running", "warmupSeconds": 600, "workSeconds": 60, "recoverySeconds": 90, "rounds": 6,
            "cooldownSeconds": 300, "workCue": "4:30 /km", "recoveryCue": "Easy jog", "countdownSeconds": 5
          }
        }
      ]
    }

