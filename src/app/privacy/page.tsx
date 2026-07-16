"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeftIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";

export default function PrivacyPage() {
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

      <div className="max-w-3xl mx-auto px-6 py-24 space-y-12">

        <section className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#D70466]/20 flex items-center justify-center">
            <ShieldCheckIcon className="h-8 w-8 text-[#D70466]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black">Politique de Confidentialité</h1>
          <p className="text-zinc-400 text-sm">Dernière mise à jour : Juillet 2025</p>
        </section>

        {/* Introduction */}
        <section className="space-y-4">
          <p className="text-zinc-300 text-sm leading-relaxed">
            La protection de vos données personnelles est une priorité chez Chillers. Cette politique de 
            confidentialité explique quelles informations nous collectons, comment nous les utilisons et 
            quels sont vos droits.
          </p>
        </section>

        {/* Données collectées */}
        <section className="space-y-4">
          <h2 className="text-xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-[#D70466]" />
            Données collectées
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Chillers ne collecte aucune donnée personnelle identifiable. Plus précisément :
          </p>
          <ul className="space-y-2 text-zinc-400 text-sm ml-4">
            <li className="flex gap-2">
              <span className="text-[#D70466] mt-0.5">&#8226;</span>
              <span>Nous ne créons pas de compte utilisateur et ne demandons aucune inscription.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#D70466] mt-0.5">&#8226;</span>
              <span>Nous ne collectons ni nom, ni adresse email, ni numéro de téléphone.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#D70466] mt-0.5">&#8226;</span>
              <span>Nous ne stockons aucune donnée de paiement.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#D70466] mt-0.5">&#8226;</span>
              <span>Nous ne suivons pas votre activité à des fins publicitaires.</span>
            </li>
          </ul>
        </section>

        {/* Cookies et technologies similaires */}
        <section className="space-y-4">
          <h2 className="text-xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-[#7C3AED]" />
            Cookies et technologies similaires
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Notre site peut utiliser des cookies techniques strictement nécessaires au fonctionnement 
            de la plateforme (par exemple, la sauvegarde de vos préférences d&apos;affichage). Ces cookies 
            ne contiennent aucune information personnelle et ne sont jamais partagés avec des tiers.
          </p>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Nous n&apos;utilisons aucun cookie de tracking, aucune balise pixel, et aucun outil de 
            surveillance comportementale.
          </p>
        </section>

        {/* Services tiers */}
        <section className="space-y-4">
          <h2 className="text-xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-emerald-400" />
            Services tiers
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Chillers affiche des liens vers des contenus hébergés par des plateformes tierces. Lorsque 
            vous cliquez sur un lien et accédez à un service externe, vos données sont soumises à la 
            politique de confidentialité de ce service tiers. Nous n&apos;avons aucun contrôle sur les 
            pratiques de ces plateformes et vous invitons à consulter leurs propres politiques.
          </p>
        </section>

        {/* Données de session */}
        <section className="space-y-4">
          <h2 className="text-xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-amber-400" />
            Données locales (localStorage)
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Nous utilisons le <code className="text-[#D70466] text-xs bg-zinc-800 px-1.5 py-0.5 rounded">localStorage</code> de 
            votre navigateur pour stocker :
          </p>
          <ul className="space-y-2 text-zinc-400 text-sm ml-4">
            <li className="flex gap-2">
              <span className="text-[#D70466] mt-0.5">&#8226;</span>
              <span>Votre progression de lecture (épisode en cours, durée vue).</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#D70466] mt-0.5">&#8226;</span>
              <span>Vos préférences d&apos;affichage (langue, qualité).</span>
            </li>
          </ul>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Ces données restent exclusivement sur votre appareil et ne sont jamais transmises à nos serveurs.
          </p>
        </section>

        {/* Sécurité */}
        <section className="space-y-4">
          <h2 className="text-xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-[#D70466]" />
            Sécurité
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables pour protéger 
            nos services. Cependant, aucun système n&apos;est totalement sécurisé. Nous vous encourageons à 
            adopter de bonnes pratiques de sécurité en ligne.
          </p>
        </section>

        {/* Modifications */}
        <section className="space-y-4">
          <h2 className="text-xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-[#7C3AED]" />
            Modifications de cette politique
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment. 
            Toute modification sera affichée sur cette page avec une date de mise à jour actualisée.
          </p>
        </section>

        {/* Contact */}
        <section className="space-y-4">
          <h2 className="text-xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-emerald-400" />
            Contact
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Pour toute question relative à cette politique de confidentialité, contactez-nous à :{" "}
            <a href="mailto:contact@chillers.app" className="text-[#D70466] hover:underline">
              contact@chillers.app
            </a>
          </p>
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
