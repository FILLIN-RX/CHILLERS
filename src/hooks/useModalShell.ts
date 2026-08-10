"use client";

import { useEffect } from "react";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";

interface UseModalShellArgs {
  isOpen: boolean;
  onClose: () => void;
  /** Disable the Escape-to-close shortcut (default false). */
  disableEscape?: boolean;
}

/**
 * useModalShell — encapsulates the two side effects every modal shares:
 *  1. Scroll lock on `<body>` while open (via the modalScrollLock module).
 *  2. Escape key close.
 *
 * Both are cleaned up on close / unmount, and re-applied automatically
 * when the modal re-opens.
 */
export function useModalShell({ isOpen, onClose, disableEscape = false }: UseModalShellArgs) {
  useEffect(() => {
    if (!isOpen) return;
    acquireModalScrollLock();
    if (disableEscape) return () => releaseModalScrollLock();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      releaseModalScrollLock();
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose, disableEscape]);
}
