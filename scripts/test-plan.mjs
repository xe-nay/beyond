// A small plan dated from today, for the simulator walkthrough (.maestro/plan.yaml): today a strength
// workout with warm-ups, tomorrow cardio, then a rest day. Printed as JSON; CI puts it on the
// simulator's clipboard for the Import screen's Paste.
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
console.log(JSON.stringify({
  format: 'beyond-training',
  version: 1,
  id: 'walkthrough',
  entries: [
    { id: 'upper', date: day(0), type: 'strength', name: 'Test Upper', exercises: [
      { name: 'Incline Dumbbell Press', sets: 2, minReps: 8, maxReps: 12, rir: 2, restSeconds: 90, warmupSets: 2 },
      { name: 'Lat Pulldown', sets: 2, minReps: 8, maxReps: 12, rir: 2, restSeconds: 90, warmupSets: 1 },
    ] },
    { id: 'run', date: day(1), type: 'cardio', name: 'Test run/walk', intervals: {
      activityType: 'Running', warmupSeconds: 300, workSeconds: 90, recoverySeconds: 120, rounds: 4, cooldownSeconds: 300,
      workPace: '7:15-8:15', recoveryPace: '10:00-12:00', workCue: 'Easy jog', recoveryCue: 'Walk',
    } },
    { id: 'rest', date: day(2), type: 'rest', name: 'Rest' },
  ],
}));
