import { feedStreamStore } from "./FeedStreamStore";

let timer: number | null = null;
let hotTimer: number | null = null;
let refs = 0;

function tickPost() {
  feedStreamStore.pushPost();
  timer = window.setTimeout(tickPost, 350 + Math.random() * 900);
}

function tickHot() {
  if (Math.random() < 0.82) feedStreamStore.pushHotMoment();
  hotTimer = window.setTimeout(tickHot, 2200 + Math.random() * 3800);
}

export function startFeedStreamBot(): () => void {
  refs++;
  if (refs === 1) {
    if (timer === null) timer = window.setTimeout(tickPost, 500);
    if (hotTimer === null) hotTimer = window.setTimeout(tickHot, 2000);
  }
  return () => {
    refs = Math.max(0, refs - 1);
    if (refs === 0) {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (hotTimer !== null) {
        window.clearTimeout(hotTimer);
        hotTimer = null;
      }
    }
  };
}
