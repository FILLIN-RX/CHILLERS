// Reference-counted body scroll lock for stacked modals (e.g. SearchOverlay
// open on top of a NotificationModal). Each call to `acquireModalScrollLock`
// increments the counter; the first caller saves and applies `overflow: hidden`,
// the last releaser restores the previous value. This prevents one modal's
// cleanup from unlocking scroll while another modal is still open.
let count = 0;
let savedOverflow: string | null = null;

export function acquireModalScrollLock(): void {
  if (typeof document === "undefined") return;
  count += 1;
  if (count === 1) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}

export function releaseModalScrollLock(): void {
  if (typeof document === "undefined") return;
  count = Math.max(0, count - 1);
  if (count === 0) {
    document.body.style.overflow = savedOverflow ?? "";
    savedOverflow = null;
  }
}
