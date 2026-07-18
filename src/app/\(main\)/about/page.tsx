"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeftIcon, PlayIcon, MagnifyingGlassIcon, HeartIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";

export default function AboutPage() {
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

      <div className="max-w-4xl mx-auto px-6 py-24 space-y-16">

        {/* Hero */}
        <section className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-[#D70466]/20 flex items-center justify-center">
            <PlayIcon className="h-10 w-10 text-[#D70466]" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight">
            Bienvenue sur <span className="text-[#D70466]">Chillers</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            L&apos;innovation au service du divertissement
          </p>
        </section>

        {/* Notre Vision */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-[#D70466]" />
            Notre Vision
          </h2>
          <p className="text-zinc-300 leading-relaxed">
            Chez Chillers, nous croyons que le divertissement doit être fluide, accessible et intuitif. 
            Notre mission est de redéfinir la manière dont vous explorez vos contenus préférés en vous 
            offrant une interface épurée, performante et pensée pour l&apos;utilisateur.
          </p>
        </section>

        {/* Pourquoi Chillers */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-[#7C3AED]" />
            Pourquoi Chillers ?
          </h2>
          <p className="text-zinc-300 leading-relaxed">
            Le projet est né d&apos;une volonté simple : simplifier la navigation dans l&apos;immensité du contenu 
            numérique actuel. Passionnés par le développement web et l&apos;expérience utilisateur (UX), nous 
            avons conçu cette plateforme comme un outil de découverte moderne, où la technologie sert votre 
            plaisir quotidien. Nous nous engageons à optimiser constamment nos performances pour vous offrir 
            une navigation sans compromis.
          </p>
        </section>

        {/* La communauté */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-amber-400" />
            Une approche axée sur la communauté
          </h2>
          <p className="text-zinc-300 leading-relaxed">
            Chillers n&apos;est pas seulement une plateforme, c&apos;est une communauté de passionnés. Nous mettons 
            un point d&apos;honneur à écouter vos retours pour améliorer nos fonctionnalités. Ensemble, nous 
            construisons une expérience qui évolue avec vos besoins.
          </p>
        </section>

        {/* Comment ça marche */}
        <section className="space-y-6">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-emerald-400" />
            Comment ça marche
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <MagnifyingGlassIcon className="h-8 w-8 text-[#D70466]" />
              <h3 className="font-bold text-sm">Explorez</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Parcourez notre catalogue de films, séries et anime. Utilisez les filtres par genre pour trouver exactement ce que vous cherchez.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <PlayIcon className="h-8 w-8 text-[#7C3AED]" />
              <h3 className="font-bold text-sm">Regardez</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Cliquez sur un titre et lancez la lecture. Notre player intégré vous offre une expérience de visionnage fluide sur tous vos appareils.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <HeartIcon className="h-8 w-8 text-amber-400" />
              <h3 className="font-bold text-sm">Continuez</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Votre progression est sauvegardée automatiquement. Reprenez là où vous vous étiez arrêté, sur n&apos;importe quel appareil.
              </p>
            </div>
          </div>
        </section>

        {/* Avis de non-responsabilité */}
        <section className="space-y-4 p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800">
          <h2 className="text-xl font-black flex items-center gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-amber-400" />
            Avis de non-responsabilité
          </h2>
          <div className="space-y-3 text-zinc-400 text-sm leading-relaxed">
            <p>
              <strong className="text-zinc-300">Note importante sur le contenu et la propriété intellectuelle :</strong>{" "}
              Chillers est une plateforme de référencement et d&apos;exploration de contenus. Chillers ne possède, 
              n&apos;héberge ni ne diffuse aucun fichier protégé par le droit d&apos;auteur. Tous les liens et contenus 
              accessibles via notre plateforme sont hébergés par des tiers et sont fournis à titre informatif 
              ou de divertissement uniquement.
            </p>
            <p>
              Nous respectons scrupuleusement les droits de propriété intellectuelle. Si vous êtes titulaire 
              d&apos;un droit d&apos;auteur et estimez qu&apos;un contenu référencé sur notre site porte atteinte à vos droits, 
              veuillez nous contacter immédiatement via notre{" "}
              <Link href="/contact" className="text-[#D70466] hover:underline">page de contact</Link>{" "}
              afin que nous puissions traiter votre demande de retrait dans les plus brefs délais.
            </p>
            <p>
              En utilisant Chillers, vous reconnaissez que l&apos;utilisation du contenu reste sous votre entière 
              responsabilité et doit être conforme aux lois en vigueur dans votre juridiction.
            </p>
          </div>
        </section>

        <div className="text-center pt-8">
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
