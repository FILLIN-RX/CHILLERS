"use client";

import { useEffect, useState, useCallback } from "react";
import {
  adminGetRequests,
  adminRetryRequest,
  type AdminMediaRequest,
} from "@/services/admin";
import {
  Sparkle,
  ArrowsClockwise,
  MagnifyingGlass,
  FilmReel,
  Television,
  CheckCircle,
  Hourglass,
  XCircle,
  Users,
  Play,
} from "@phosphor-icons/react";

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminMediaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetRequests({
        status: statusFilter,
        type: typeFilter,
        search: search.trim() || undefined,
      });
      if (res?.success && Array.isArray(res.data)) {
        setRequests(res.data);
      }
    } catch (err: any) {
      console.error("Erreur chargement demandes:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleRetry = async (id: string, title: string) => {
    setRetryingId(id);
    setActionMessage(null);
    try {
      const res = await adminRetryRequest(id);
      if (res?.success) {
        setActionMessage({ text: `Recherche relancée pour "${title}" sur le microservice Go !`, type: "success" });
        await fetchRequests();
      } else {
        setActionMessage({ text: res?.message || "Échec de la relance", type: "error" });
      }
    } catch (err: any) {
      setActionMessage({ text: "Erreur serveur lors de la relance", type: "error" });
    } finally {
      setRetryingId(null);
    }
  };

  const counts = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending" || r.status === "searching").length,
    fulfilled: requests.filter((r) => r.status === "fulfilled").length,
    notFound: requests.filter((r) => r.status === "not_found").length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "fulfilled":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 rounded-xl"
            style={{ borderRadius: "10px" }}
          >
            <CheckCircle size={14} weight="fill" />
            Trouvé & Intégré
          </span>
        );
      case "searching":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-blue-500/15 text-blue-700 border border-blue-500/30 rounded-xl"
            style={{ borderRadius: "10px" }}
          >
            <div className="w-2.5 h-2.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            Scraping Go...
          </span>
        );
      case "not_found":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-rose-500/15 text-rose-700 border border-rose-500/30 rounded-xl"
            style={{ borderRadius: "10px" }}
          >
            <XCircle size={14} weight="fill" />
            Non trouvé
          </span>
        );
      case "pending":
      default:
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-amber-500/15 text-amber-700 border border-amber-500/30 rounded-xl"
            style={{ borderRadius: "10px" }}
          >
            <Hourglass size={14} />
            En attente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-fade-in text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Sparkle size={24} className="text-amber-700" weight="fill" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Demandes de Contenu & Recherche Go
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gérez les films et séries demandés par les utilisateurs. Le microservice Go effectue le scraping profond automatique.
          </p>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors rounded-[5px] self-start md:self-auto"
          style={{ borderRadius: "10px" }}
        >
          <ArrowsClockwise size={16} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* Action Banner */}
      {actionMessage && (
        <div
          className={`p-3.5 text-xs font-medium border flex items-center justify-between rounded-xl ${
            actionMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"
              : "bg-rose-500/10 border-rose-500/20 text-rose-700"
          }`}
          style={{ borderRadius: "10px" }}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-600 hover:text-slate-800">
            ✕
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-xl" style={{ borderRadius: "10px" }}>
          <span className="text-xs text-slate-500 uppercase tracking-wider">Total Demandes</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{counts.total}</p>
        </div>
        <div className="p-4 bg-white border border-blue-500/20 rounded-xl" style={{ borderRadius: "10px" }}>
          <span className="text-xs text-blue-700/70 uppercase tracking-wider">En cours / Attente</span>
          <p className="text-2xl font-bold text-blue-700 mt-1">{counts.pending}</p>
        </div>
        <div className="p-4 bg-white border border-emerald-500/20 rounded-xl" style={{ borderRadius: "10px" }}>
          <span className="text-xs text-emerald-700/70 uppercase tracking-wider">Trouvés & Liés</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{counts.fulfilled}</p>
        </div>
        <div className="p-4 bg-white border border-rose-500/20 rounded-xl" style={{ borderRadius: "10px" }}>
          <span className="text-xs text-rose-700/70 uppercase tracking-wider">Non Trouvés</span>
          <p className="text-2xl font-bold text-rose-700 mt-1">{counts.notFound}</p>
        </div>
      </div>

      {/* Controls / Filters */}
      <div className="flex flex-col md:flex-row items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl" style={{ borderRadius: "10px" }}>
        {/* Search */}
        <div className="relative flex-1 w-full">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par titre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary rounded-xl"
            style={{ borderRadius: "10px" }}
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-44 px-3 py-2 bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-primary rounded-xl"
          style={{ borderRadius: "10px" }}
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="searching">Scraping en cours</option>
          <option value="fulfilled">Trouvés</option>
          <option value="not_found">Non trouvés</option>
        </select>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full md:w-36 px-3 py-2 bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-primary rounded-xl"
          style={{ borderRadius: "10px" }}
        >
          <option value="all">Tous les types</option>
          <option value="movie">Films</option>
          <option value="series">Séries</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-slate-200 overflow-x-auto bg-white rounded-xl" style={{ borderRadius: "10px" }}>
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-4">Titre / Média</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Demandeurs</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4">Sources Go</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                  Chargement des demandes...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  Aucune demande trouvée avec les filtres sélectionnés.
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req._id} className="hover:bg-white transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800 text-sm">{req.title}</div>
                    {req.type === "series" && (
                      <div className="text-[11px] text-slate-500 font-mono">
                        Saison {req.season || 1} • Épisode {req.episode || 1}
                      </div>
                    )}
                    {req.year && <span className="text-[10px] text-slate-400">({req.year})</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                      {req.type === "movie" ? <FilmReel size={14} /> : <Television size={14} />}
                      {req.type === "movie" ? "Film" : "Série"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-slate-800 font-medium bg-white/5 px-2 py-0.5 rounded-xl" style={{ borderRadius: "10px" }}>
                      <Users size={12} className="text-slate-500" />
                      {req.requestCount || 1}
                    </span>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                  <td className="py-3 px-4">
                    {req.streamSources && req.streamSources.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {req.streamSources.map((s, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 rounded-xl"
                            style={{ borderRadius: "10px" }}
                            title={s.streamUrl}
                          >
                            {s.source} ({s.server || "direct"})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleRetry(req._id, req.title)}
                      disabled={retryingId === req._id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-all disabled:opacity-50 rounded-[5px]"
                      style={{ borderRadius: "10px" }}
                    >
                      {retryingId === req._id ? (
                        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play size={12} weight="fill" />
                      )}
                      Relancer Go
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
