# Beyond

A minimal iPhone app for strength training, cardio, nutrition and progress. Everything is stored on the phone; only food lookups use the network.

- **Train**: programs and templates, a live workout with plate-loading and dumbbell visuals (kg/lb), RIR/RPE, estimated 1RM, rep drop, fatigue index, measured rest, supersets, swaps, and a flip card summary at the end.
- **Rest and cardio timers**: countdown beeps or voice cues near the end, ducking any music that is playing; guided intervals with pace cues.
- **Food**: scan a barcode (Open Food Facts) for a full product view; search only when a barcode has no data.
- **Progress**: muscle heatmap, weekly volume, strength trends, fatigue signals with their evidence, body weight and photos.
- **Import**: one dated JSON file for plans and history (`beyond-training`, version 1; Kinetic files work too).

## Build

Built on GitHub Actions (`.github/workflows/build.yml`): an unsigned `Beyond.ipa` plus a SideStore source at
`https://github.com/<owner>/beyond/releases/latest/download/source.json`. A second job runs the app in an iOS
simulator with Maestro (`.maestro/`) and keeps the screenshots.

Locally: `npm install`, `node scripts/build-exercises.mjs`, then `npx expo start --web` for the browser preview and `npm test` for the calculation tests.

## Data and credits

See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
