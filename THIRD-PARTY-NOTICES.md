# Third-party notices

## Data

- **Exercise data by [RepDB](https://repdb.co)** (free tier). Used in the app with this attribution; the dataset is downloaded at build time and is not redistributed in this repository.
- **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)**, Unlicense (public domain).
- **Food data from [Open Food Facts](https://world.openfoodfacts.org)**, Open Database License (ODbL). Product images under their own Creative Commons licences.
- **Basic foods** (eggs, rice, fruit, meat without a barcode) from [USDA FoodData Central](https://fdc.nal.usda.gov), SR Legacy, public domain, with their vitamins and minerals. Built by `scripts/build-basic-foods.py`.
- **Supplement labels** from the [NIH Dietary Supplement Label Database](https://dsld.od.nih.gov) (Office of Dietary Supplements), US government work, public domain. Looked up on request.
- Daily values for micronutrients: US FDA reference values for adults.

## Audio

Built-in voice cues, all CC0 (public domain), from Freesound:

- "Let's go - Man voice" by duducsepel (sounds 761798, 761799)
- "Lets go" and "Whoot" by Sadiquecat (sounds 802526, 802537)
- "Let's Go (male)" and "Ready Set Go! (male)" by dastudiospr (sounds 529817, 529843)
- "\"To War!\" Assault Drill Sergeant Shout" by qubodup (sound 161967)

Timer beeps are synthesised by `scripts/make-sounds.mjs`. The "on pace" line in cardio is spoken by the iPhone's built-in voice.

The optional coach voice packs are not part of this repository or the app package. The app downloads them onto the user's own device on request, for personal use, from public soundboards (myinstants.com, Voicemod Tuna).

## Libraries

- [react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter), MIT
- Expo, React Native, Reanimated, Gesture Handler, react-native-svg, Zustand: MIT
