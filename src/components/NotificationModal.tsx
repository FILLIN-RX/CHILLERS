"use client";

import React, { useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

export default function NotificationModal({
  isOpen,
  onClose,
  title,
  message,
}: NotificationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md mx-4 bg-brand-card rounded-3xl border border-brand-border glass-modal p-8 text-center"
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#D70466]/20 flex items-center justify-center">
          <span className="text-3xl">!</span>
        </div>

        <h3 className="text-xl font-black text-white mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm leading-relaxed mb-6">{message}</p>

        <button
          onClick={onClose}
          className="px-8 py-3 rounded-full bg-[#D70466] text-white font-bold text-sm hover:bg-[#b5034f] transition-all"
        >
          OK
        </button>
      </div>
    </div>
  );
}
