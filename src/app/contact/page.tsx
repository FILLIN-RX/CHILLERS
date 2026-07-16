"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, EnvelopeIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <div className="fixed top-0 left-0 z-40 p-4">
        <button
          onClick={() => { window.scrollTo(0, 0); window.history.back(); }}
          aria-label="Retour"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-24 space-y-12">

        {/* Header */}
        <section className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#D70466]/20 flex items-center justify-center">
            <EnvelopeIcon className="h-8 w-8 text-[#D70466]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black">Contactez-nous</h1>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-lg mx-auto">
            Si vous remarquez un problème, un contenu inapproprié ou une atteinte à vos droits, 
            n&apos;hésitez pas à nous écrire. Nous traitons chaque demande dans les meilleurs délais.
          </p>
        </section>

        {/* Raisons de contact */}
        <section className="space-y-4">
          <h2 className="text-lg font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-[#D70466]" />
            Pourquoi nous contacter ?
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mb-2" />
              <h3 className="text-sm font-bold">Signaler un contenu</h3>
              <p className="text-zinc-500 text-xs mt-1">
                Si un contenu référencé sur Chillers porte atteinte à vos droits d&apos;auteur, contactez-nous pour un retrait rapide.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <EnvelopeIcon className="h-5 w-5 text-[#7C3AED] mb-2" />
              <h3 className="text-sm font-bold">Signaler un bug</h3>
              <p className="text-zinc-500 text-xs mt-1">
                Vous avez trouvé un problème technique ? Décrivez-le-nous et nous le corrigerons au plus vite.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <EnvelopeIcon className="h-5 w-5 text-emerald-400 mb-2" />
              <h3 className="text-sm font-bold">Suggestion</h3>
              <p className="text-zinc-500 text-xs mt-1">
                Une idée pour améliorer Chillers ? Nous adorons entendre vos propositions.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <EnvelopeIcon className="h-5 w-5 text-[#D70466] mb-2" />
              <h3 className="text-sm font-bold">Demande DMCA</h3>
              <p className="text-zinc-500 text-xs mt-1">
                Pour toute demande relative à la propriété intellectuelle, envoyez-nous un email détaillé.
              </p>
            </div>
          </div>
        </section>

        {/* Formulaire */}
        <section className="space-y-4">
          <h2 className="text-lg font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-[#7C3AED]" />
            Envoyez-nous un message
          </h2>

          {submitted ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
              <p className="text-emerald-400 font-bold">Message envoyé !</p>
              <p className="text-zinc-400 text-sm">Nous vous répondrons dans les plus brefs délais.</p>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nom</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-[#D70466] transition-colors"
                  placeholder="Votre nom"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-[#D70466] transition-colors"
                  placeholder="votre@email.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Sujet</label>
                <select className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-[#D70466] transition-colors">
                  <option value="dmca">Demande DMCA / Retrait de contenu</option>
                  <option value="bug">Signaler un bug</option>
                  <option value="suggestion">Suggestion</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Message</label>
                <textarea
                  required
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-[#D70466] transition-colors resize-none"
                  placeholder="Décrivez votre demande..."
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#D70466] hover:bg-[#b5034f] text-white font-bold text-sm transition-all shadow-lg shadow-[#D70466]/30"
              >
                Envoyer
              </button>
            </form>
          )}
        </section>

        {/* Email direct */}
        <section className="text-center space-y-2 pt-4">
          <p className="text-zinc-500 text-xs">Ou écrivez-nous directement à :</p>
          <a href="mailto:contact@chillers.app" className="text-[#D70466] text-sm font-bold hover:underline">
            contact@chillers.app
          </a>
        </section>

        <div className="text-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/20 transition-all"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
