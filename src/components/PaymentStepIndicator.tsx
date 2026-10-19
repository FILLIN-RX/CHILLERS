"use client";

import React from "react";
import { Check } from "@phosphor-icons/react";

export type WizardStep = 1 | 2 | 3;

const STEP_LABELS: { n: WizardStep; label: string }[] = [
  { n: 1, label: "Méthode" },
  { n: 2, label: "Numéro" },
  { n: 3, label: "Confirmation" },
];

/** Indicateur « 1 Méthode — 2 Numéro — 3 Confirmation » des modaux de paiement. */
export default function PaymentStepIndicator({ step }: { step: WizardStep }) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-1.5 pt-1 pb-0.5 select-none">
      {STEP_LABELS.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <React.Fragment key={s.n}>
            {i > 0 && (
              <span
                className={`h-px w-4 sm:w-5 rounded-full ${
                  done || active ? "bg-brand-primary/60" : "bg-zinc-700"
                }`}
              />
            )}
            <span className="flex items-center gap-1">
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center border shrink-0 ${
                  active
                    ? "bg-brand-primary border-brand-primary text-white shadow-[0_0_10px_rgba(244,42,124,0.35)]"
                    : done
                      ? "bg-brand-primary/15 border-brand-primary/50 text-brand-primary"
                      : "bg-zinc-800 border-zinc-700 text-zinc-500"
                }`}
              >
                {done ? <Check className="w-3 h-3" weight="bold" /> : s.n}
              </span>
              <span
                className={`text-[10px] font-bold ${
                  active ? "text-white" : done ? "text-zinc-300" : "text-zinc-500"
                }`}
              >
                {s.label}
              </span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
