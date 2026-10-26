// The complete import format. "Copy the guide" on the Import screen copies this text into an AI chat,
// and scripts/make-import-doc.mjs writes the same text to docs/IMPORT-FORMAT.md. It contains no
// backticks so it can live in a template string; code blocks are indented by four spaces.
export const IMPORT_GUIDE = `# Beyond training import: the complete format

This guide explains every part of the file Beyond imports. It is written so you can paste it into an AI chat (ChatGPT, Gemini or any other) and then describe your training in your own words: the chat writes the file, you copy its reply and tap Paste in Beyond (Train > Import).

## Instructions for the AI writing the file

- Reply with ONE JSON object and nothing else. No comments, no trailing commas, no text before or after (a code block around it is fine).
- Follow the field names, types and ranges below exactly. Leave out a field you do not know rather than inventing a value.
- Weights in kilograms. Convert pounds: kg = lb x 0.4536, rounded to 0.5.
- RIR means "reps in reserve" (how many more reps were possible). If I give RPE instead: RIR = 10 - RPE.
- Give every entry a date in YYYY-MM-DD. If I say "last Monday" or "three weeks ago", work out the real date; if you do not know today's date, ask me before writing the file.
- Use exercise names as I say them, with the equipment when it matters ("Dumbbell Bench Press", "Cable Lateral Raise"). If I gave you Beyond's exercise list, copy names exactly from it.
- Make a new file "id" for every file, unless I ask you to correct a file you already gave me: then keep the same file id and entry ids.
- For a plan, give every date of its period an entry: a workout, a cardio session or a rest day ("type": "rest").
- For cardio, put every pace in the pace fields (workPace, recoveryPace, warmupPace, cooldownPace) as minutes:seconds per km, a window "7:15-8:15" or one value "7:30". Follow the checklist at the end of section 8.


## 1. How importing works

- The app reads the file's period: its first and last date. Before importing you choose:
  - Replace this period: everything planned in the app between those dates is removed and the file's plan takes its place. Every date in the period with no workout or cardio in the file becomes a rest day (no program workout is shown there). Workouts already logged are never removed.
  - Keep what is there: nothing is deleted; days that already have something ask what to keep (below).
- One file holds any number of entries. Each entry is ONE workout, ONE cardio session or ONE rest day on ONE date.
- An entry with a "performed" block is history: a workout already done, with its sets, reps, weights and RIR. Its date must be today or earlier.
- An entry without "performed" is a plan for that date. A planned workout shows on Today as "Planned today" with a Start button, and as a ring on that day in the calendar. Planned cardio shows in the Cardio screen under "Planned", ready to start.
- The import does not create a repeating weekly program. Programs are made in the app (templates or Build my program). To plan several weeks, write one entry per workout per date.
- Before importing, the app lists every entry with its date and whether it is History or Planned. If any entry has an error, nothing is imported and the errors are listed (see section 10).
- Conflicts: when an entry falls on a date that already has a workout of the same type in the app (strength with strength, cardio with cardio), the app asks for that entry:
  - Mine: keep what is in the app, skip this entry (the default).
  - Import: use this entry and remove what the app had on that date (same type only).
  - Both: keep both.
  "For every day" sets one choice for all of them at once. A workout in progress in the app is never touched.
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
- type: "strength" (the default when left out), "cardio" or "rest". Anything else is an error.
- name (optional): shown in the app, such as "Upper A" or "Easy run". Strength defaults to "Imported session"; cardio to its activity.
- notes (optional): free text kept with the workout.
- performed (optional): the results; makes the entry history. Only for today or earlier.

A strength entry needs "exercises" (the plan), "performed" with "sets" (the results), or both. A cardio entry needs "intervals". A rest entry needs nothing else:

    { "id": "rest-2026-11-01", "date": "2026-11-01", "type": "rest", "name": "Rest", "notes": "Walk if you like" }

Write a rest entry for every rest day of a plan, so the plan covers each date of its period (a strength, cardio or rest entry on every day). In "Replace this period" days without an entry become rest days anyway; in "Keep what is there" only rest entries mark them.


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

A cardio entry is one guided session the phone times and talks you through. Every session has the same shape:

    warm-up  ->  work, recovery, work, recovery ... work  ->  cool-down
                 (rounds x work, rounds - 1 recoveries: no recovery after the last work)

Planned length = warmupSeconds + rounds x workSeconds + (rounds - 1) x recoverySeconds + cooldownSeconds.

- A steady session (an easy 40-minute run) is ONE round: "rounds": 1, "workSeconds": 2400, no recovery.
- Run/walk intervals: work = the running part, recovery = the walking part.
- Phases are timed, not measured by distance. For "6 x 400 m", estimate each repeat's time from its pace (400 m at 5:00 /km = 120 seconds).
- Every work phase in one session is the same length with the same targets, and so is every recovery. A session that changes inside (a pyramid, or 3 x 1 min then 3 x 2 min) is written as separate cardio entries, or as the nearest even version. Say so in "notes".

Example: run/walk intervals with a pace for every phase.

    {
      "id": "run-walk-2026-10-26",
      "date": "2026-10-26",
      "type": "cardio",
      "name": "Run/walk A, week 1",
      "notes": "Jog stays conversational, RPE 4-5. Repeat the week if sore.",
      "intervals": {
        "activityType": "Running",
        "warmupSeconds": 300,
        "workSeconds": 90,
        "recoverySeconds": 120,
        "rounds": 6,
        "cooldownSeconds": 300,
        "warmupCue": "Brisk walk",
        "workCue": "Easy jog",
        "recoveryCue": "Walk",
        "cooldownCue": "Walk",
        "warmupPace": "10:30-12:30",
        "workPace": "7:15-8:15",
        "recoveryPace": "10:00-12:00",
        "cooldownPace": "10:30-12:30",
        "paceUnit": "km",
        "countdownSeconds": 5
      }
    }

### intervals: every field

Lengths (whole seconds). Each one can instead be given in minutes with the same name ending in Minutes ("warmupMinutes": 5 is 300 seconds).

- warmupSeconds: 0 to 3600. Default 0 (no warm-up).
- workSeconds (required): length of ONE work phase, 5 to 14400.
- recoverySeconds: length of ONE recovery between work phases, 0 to 3600. Default 0.
- rounds: how many work phases, a whole number 1 to 50. Default 1.
- cooldownSeconds: 0 to 3600. Default 0.

The activity:

- activityType: exactly one of Running, Walking, Cycling, Rowing, Swimming, Elliptical, Stairs, HIIT. Default Running. Run, jog and treadmill are read as Running; walk and hike as Walking; bike and spin as Cycling. Anything else stops the import with an error.
- Running, Walking and Cycling are measured by GPS outdoors: distance, live pace and pace coaching. The others are timed only, so their paces are ignored; use cues for effort.

Targets for each phase (all optional):

- warmupPace, workPace, recoveryPace, cooldownPace: the pace window for that phase, as minutes:seconds per km (or per mile with "paceUnit": "mi"). Write a window "7:15-8:15" (fastest-slowest) or one target "7:30". Also accepted: "7:30 /km", "8:00 min/mi", a number of seconds per km (450), or { "fast": "7:15", "slow": "8:15" }. A pace with any other unit ("/500m", "km/h") stops the import with an error.
- paceUnit: "km" (default) or "mi". How paces are read when they have no unit, shown and spoken.
- warmupCue, workCue, recoveryCue, cooldownCue: a few words shown on screen and spoken at the start of the phase: an effort or what to do ("Easy jog", "Walk", "Tempo", "Hard", "All out", "Light paddle"). Keep each under 30 characters. Defaults: warm-up "Easy", cool-down "Ease down", work and recovery none.
- A pace written inside a cue ("Easy walk 10:00-12:00 min/km") is read as that phase's pace when its pace field is missing, but prefer the pace fields.
- countdownSeconds: beeps before each phase change, 0 to 30. Default 5. The app plays 3, 5, 10 or 15 seconds of beeps (the nearest length below); 0 plays only the change tone.

Put explanations, RPE and the talk test in the entry's "notes": they are shown in full on the day and on Today, not spoken.

### What happens during the session

- Before each change: the countdown beeps, then a tone.
- As each phase starts, a voice says it, for example: "Round 2 of 6. Work, 90 seconds. Easy jog. Pace 7 15 to 8 15 per kilometre." On recoveries it says how many rounds are left; on the last work phase, "Last round". At the end: "Workout complete".
- Halfway through any phase of 4 minutes or more, it says the time left.
- With a pace window on a GPS activity, after the first 30 seconds of the phase: "Pick it up" when slower than the window for 8 seconds, "Ease off" when faster, then "Back on pace" when you return, with your live pace and the target. At most once every 40 seconds. A little slack each way (4% slower, 6% faster) keeps GPS wobble from nagging.
- This also works with the screen locked, as long as the phone's sound is on. The voice can be turned off in the cardio screen or the timer settings.

### performed for cardio (history)

    "performed": { "minutes": 42, "distanceKm": 8.2, "rpe": 7, "avgHr": 152 }

- minutes: duration. Default: the planned length.
- distanceKm (optional): distance in kilometres (miles x 1.609).
- rpe (optional): effort 1 to 10.
- avgHr (optional): average heart rate in beats per minute.

Calories for cardio are estimated from the activity (MET values) and your body weight when one is logged.

### Checklist before you reply

- "type": "cardio" and an "intervals" object on every cardio entry.
- activityType is one of the eight names above.
- Lengths are whole seconds (or ...Minutes), workSeconds is ONE work phase, and rounds counts the work phases.
- Paces are minutes:seconds per km, as "fastest-slowest" or one value, in the ...Pace fields, not only in the cues.
- Cues are short words; long explanations go in "notes".


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
- "Entry N: type must be "strength", "cardio" or "rest"."
- "Entry N: a rest day has no results." Remove "performed" from the rest entry.
- "Entry N: a future date cannot have results." Remove "performed" or fix the date.
- "Entry N: a workout needs "exercises" or performed "sets"."
- "Entry N: unknown exercise "X"." / "a performed set names an unknown exercise." Rename it (see section 7).
- "Entry N: cardio needs workSeconds (or workMinutes)."
- "Entry N: activityType "X" is not one of ..." Use one of the eight activities in section 8.
- "Entry N: workPace "X" is not a pace." (or warmupPace, recoveryPace, cooldownPace) Write minutes:seconds per km: "7:30" or "7:15-8:15".
- "Entry N: rounds must be a whole number from 1 to 50." / "...Seconds must be a number from A to B." / "countdownSeconds must be 0 to 30."
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
          "intervals": { "activityType": "Running", "workSeconds": 2400, "rounds": 1, "workCue": "Easy", "workPace": "5:45-6:15" },
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
            "cooldownSeconds": 300, "workCue": "Hard", "workPace": "4:20-4:40", "recoveryCue": "Easy jog", "recoveryPace": "6:30-7:30",
            "warmupPace": "6:00-6:45", "countdownSeconds": 5
          }
        }
      ]
    }

Now, from what I tell you below, write the file:
`;
