import { Great_Vibes } from "next/font/google";

const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400", display: "swap" });

export default function CategoriesPage() {
  return (
    <main className="relative flex min-h-[calc(100svh-5rem)] items-center justify-center overflow-hidden bg-brand-dark px-6 pb-24 pt-28 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary/10 blur-[110px]" />
        <div className="absolute left-1/2 top-1/2 h-px w-[min(78vw,44rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" />
        <div className="absolute left-1/2 top-[calc(50%-8.5rem)] h-px w-[min(52vw,30rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-brand-primary/40 to-transparent" />
      </div>

      <section className="relative z-10 mx-auto flex max-w-2xl flex-col items-center">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.45em] text-amber-100/65 sm:text-xs">
          Une nouvelle histoire se prépare
        </p>

        <h1
          className={`${greatVibes.className} text-7xl leading-tight text-white sm:text-9xl`}
          style={{
            WebkitTextStroke: "0.7px #f5a2c4",
            WebkitTextFillColor: "#fff7fb",
            textShadow: "0 0 32px rgba(244, 42, 124, 0.2)",
          }}
        >
          Nollywood
        </h1>

        <div className="my-7 flex items-center gap-3 text-brand-primary/80">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-brand-primary/70" />
          <span className="h-1 w-1 rounded-full bg-brand-primary/80" />
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-brand-primary/70" />
        </div>

        <p
          className={`${greatVibes.className} text-5xl text-amber-100 sm:text-6xl`}
          style={{
            WebkitTextStroke: "0.45px #f5a2c4",
            WebkitTextFillColor: "#fff1d6",
          }}
        >
          Coming soon
        </p>

        <p className="mt-5 max-w-md text-sm leading-6 text-zinc-400 sm:text-base">
          Notre sélection de cinéma africain arrive bientôt sur CHILLERS.
          Préparez-vous à découvrir de belles histoires.
        </p>

        <span className="mt-8 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          En préparation
        </span>
      </section>
    </main>
  );
}
