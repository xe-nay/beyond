import { makeMutable } from 'react-native-reanimated';

// A day swipe ends with the finger lifting over whatever card is underneath, which would count as a
// tap on it (a swipe on Today used to open Food that way). Taps right after a swipe are ignored.
let last = 0;
export const markSwipe = () => { last = Date.now(); };
export const swipedRecently = () => Date.now() - last < 400;

// A sideways swipe that belongs to something inside the page (turning a card, opening an exercise)
// sets this while it runs; the day swipe then stays still.
export const innerSwipe = makeMutable(0);

/** Lets the day swipe move again shortly after an inner swipe ends, so the lift that ends both never changes the day. */
export const releaseInner = () => { setTimeout(() => innerSwipe.set(0), 150); };
