// Lock page scrolling while a dialog is open without the page changing width: the
// scrollbar's width is measured at the moment of locking (0 for overlay scrollbars) and
// put back as padding, so nothing behind the dialog shifts. Counted, so nested opens and
// React's dev double-mount (lock, unlock, lock) stay balanced.

let count = 0;

export function lockScroll() {
  if (typeof document === "undefined") return;
  const d = document.documentElement;
  if (count++ === 0) {
    d.style.setProperty("--sbw", `${Math.max(0, window.innerWidth - d.clientWidth)}px`);
    d.classList.add("scroll-locked");
  }
}

export function unlockScroll() {
  if (typeof document === "undefined" || count === 0) return;
  if (--count === 0) document.documentElement.classList.remove("scroll-locked");
}
