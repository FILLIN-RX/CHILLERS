"use client";

import React, { useState } from "react";

export default function TestErrorPage() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error("Erreur de test déclenchée volontairement pour prévisualiser la page d'erreur Chillers !");
  }

  return (
    <div className="min-h-screen bg-[#060608] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-xl font-bold mb-3">Page de test d'erreur (500)</h1>
        <p className="text-zinc-400 text-sm mb-6">
          Cliquez sur le bouton ci-dessous pour déclencher une erreur d'exécution et afficher instantanément la nouvelle page <span className="text-[#D70466] font-mono">error.tsx</span> stylée avec le mur Pinterest.
        </p>
        <button
          onClick={() => setShouldThrow(true)}
          className="w-full py-3.5 px-6 rounded-xl bg-[#D70466] hover:bg-[#E91E63] text-white font-bold text-sm shadow-[0_0_20px_rgba(215,4,102,0.4)] transition-all cursor-pointer"
        >
          Déclencher l'erreur (Afficher error.tsx)
        </button>
      </div>
    </div>
  );
}
