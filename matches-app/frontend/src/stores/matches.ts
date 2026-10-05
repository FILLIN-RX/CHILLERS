import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SportMatch, MatchLeague, SportType, CountryInfo } from '../types/matches';
import { fetchMatches, fetchLeagues, fetchCountries, simulateTestGoal } from '../services/api';
import { liveSseClient, type GoalEventData, type MatchUpdateData } from '../services/sse.service';
import { classifyLeague, resolveMatchCompetition } from '../utils/matchClassifier';

const FAVORITES_STORAGE_KEY = 'chillers_matches_favorites';

export const useMatchesStore = defineStore('matches', () => {
  // State
  const matches = ref<SportMatch[]>([]);
  const leagues = ref<MatchLeague[]>([]);
  const countries = ref<CountryInfo[]>([]);
  const selectedCountry = ref<string>('all');
  const selectedDate = ref<string>(new Date().toISOString().split('T')[0]);
  const selectedMonth = ref<string | null>(null);
  const selectedSeason = ref<string | null>(null);
  const selectedSport = ref<SportType | 'all'>('football');
  const selectedLeague = ref<string>('all');
  const searchQuery = ref<string>('');
  const statusFilter = ref<'all' | 'live' | 'favorites'>('all');
  const favorites = ref<string[]>([]);
  const isLoading = ref<boolean>(false);
  const isRefreshing = ref<boolean>(false);

  // SSE Real-time State
  const isSseConnected = ref<boolean>(false);
  const sseStatus = ref<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const lastSseTimestamp = ref<number | null>(null);
  const activeGoalAlert = ref<GoalEventData | null>(null);
  const updatedMatchIds = ref<Record<string, number>>({});

  // Real-time minute ticker (tique chaque seconde)
  const tickerTime = ref<number>(Date.now());
  let tickerTimer: any = null;

  function startMinuteTicker() {
    if (tickerTimer) return;
    tickerTimer = setInterval(() => {
      tickerTime.value = Date.now();
    }, 1000);
  }

  function stopMinuteTicker() {
    if (tickerTimer) {
      clearInterval(tickerTimer);
      tickerTimer = null;
    }
  }

  // Activer le ticker immédiatement
  startMinuteTicker();

  // Load favorites from localStorage
  try {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (saved) favorites.value = JSON.parse(saved);
  } catch {}

  // Getters
  const liveMatches = computed(() => matches.value.filter((m) => m.status === 'live'));
  const liveCount = computed(() => liveMatches.value.length);

  const heroMatch = computed(() => {
    if (liveMatches.value.length > 0) return liveMatches.value[0];
    return matches.value[0] || null;
  });

  const filteredMatches = computed(() => {
    let result = matches.value;

    // Filtre strict : charger et afficher uniquement les matchs du jour sélectionné
    if (selectedDate.value && !selectedMonth.value && !selectedSeason.value) {
      const target = selectedDate.value;
      const DAY_MS = 86_400_000;
      const targetMs = Date.parse(`${target}T00:00:00Z`);
      result = result.filter((m) => {
        if (!m.startTime) return false;
        const ts = Date.parse(m.startTime);
        if (Number.isNaN(ts)) return false;
        // ±1 jour : une journée ESPN couvre aussi les matchs du lendemain UTC
        return Math.abs(ts - (ts % DAY_MS) - targetMs) <= DAY_MS;
      });
    }

    if (statusFilter.value === 'live') {
      result = result.filter((m) => m.status === 'live');
    } else if (statusFilter.value === 'favorites') {
      result = result.filter((m) => favorites.value.includes(m.id));
    }

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.league.name.toLowerCase().includes(q)
      );
    }

    return result;
  });

  const groupedByLeague = computed(() => {
    const groups: Record<
      string,
      {
        league: MatchLeague;
        matches: SportMatch[];
      }
    > = {};

    for (const match of filteredMatches.value) {
      const resolvedLeague = resolveMatchCompetition(match);
      match.league = resolvedLeague;
      const key = resolvedLeague.id || resolvedLeague.name;
      if (!groups[key]) {
        groups[key] = {
          league: resolvedLeague,
          matches: [],
        };
      }
      groups[key].matches.push(match);
    }

    const list = Object.values(groups).map((group) => {
      const info = classifyLeague(group.league, group.matches);
      return {
        ...group,
        category: info.category,
        categoryLabel: info.categoryLabel,
        badgeLabel: info.badgeLabel,
        badgeColor: info.badgeColor,
        isWomen: info.isWomen,
        isYouth: info.isYouth,
        youthLabel: info.youthLabel,
        isFriendly: info.isFriendly,
        isSecondDivision: info.isSecondDivision,
        isEuroOrIntl: info.isEuroOrIntl,
        priority: info.priority,
      };
    });

    // Tri par ordre de priorité : Euro/Intl (5) -> Majeures (10) -> Coupes (15) -> Championnats (20) -> D2/Liga 2 (25) -> Féminin (30) -> Jeunes (40) -> Amicaux (50)
    list.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.league.name.localeCompare(b.league.name);
    });

    return list;
  });

  function isFavorite(matchId: string): boolean {
    return favorites.value.includes(matchId);
  }

  function toggleFavorite(matchId: string) {
    if (favorites.value.includes(matchId)) {
      favorites.value = favorites.value.filter((id) => id !== matchId);
    } else {
      favorites.value.push(matchId);
    }
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites.value));
    } catch {}
  }

  async function loadMatches(background = false) {
    if (!background) isLoading.value = true;
    else isRefreshing.value = true;

    try {
      const data = await fetchMatches({
        country: selectedCountry.value !== 'all' ? selectedCountry.value : undefined,
        league: selectedLeague.value !== 'all' ? selectedLeague.value : undefined,
        sport: selectedSport.value !== 'all' ? selectedSport.value : undefined,
        date: selectedMonth.value ? undefined : selectedDate.value,
        month: selectedMonth.value || undefined,
        season: selectedSeason.value || undefined,
      });
      // Initialiser clockUpdatedAt pour les matches en direct
      const now = Date.now();
      for (const m of data) {
        if (m.status === 'live' && !m.clockUpdatedAt) {
          m.clockUpdatedAt = now;
        }
      }
      matches.value = data;
    } catch (e) {
      console.error('[Store] Failed to load matches:', e);
    } finally {
      isLoading.value = false;
      isRefreshing.value = false;
    }
  }

  async function loadCountries() {
    try {
      const data = await fetchCountries();
      countries.value = data;
    } catch (e) {
      console.error('[Store] Failed to load countries:', e);
    }
  }

  async function loadLeagues(countryId?: string) {
    try {
      const data = await fetchLeagues(countryId || selectedCountry.value);
      leagues.value = data;
    } catch (e) {
      console.error('[Store] Failed to load leagues:', e);
    }
  }

  function setCountry(countryId: string) {
    selectedCountry.value = countryId;
    selectedLeague.value = 'all';
    loadLeagues(countryId);
    loadMatches();
  }

  function markMatchUpdated(matchId: string) {
    updatedMatchIds.value = {
      ...updatedMatchIds.value,
      [matchId]: Date.now(),
    };
    setTimeout(() => {
      const copy = { ...updatedMatchIds.value };
      delete copy[matchId];
      updatedMatchIds.value = copy;
    }, 4000);
  }

  function handleLiveScoresUpdate(liveList: SportMatch[]) {
    lastSseTimestamp.value = Date.now();
    for (const liveMatch of liveList) {
      const existing = matches.value.find((m) => m.id === liveMatch.id);
      if (existing) {
        const scoreChanged =
          existing.homeTeam.score !== liveMatch.homeTeam.score ||
          existing.awayTeam.score !== liveMatch.awayTeam.score;
        const minuteChanged = existing.minute !== liveMatch.minute;

        if (scoreChanged || minuteChanged) {
          markMatchUpdated(liveMatch.id);
        }

        existing.homeTeam.score = liveMatch.homeTeam.score;
        existing.awayTeam.score = liveMatch.awayTeam.score;
        existing.status = liveMatch.status;
        existing.statusText = liveMatch.statusText;
        existing.statusShort = liveMatch.statusShort;
        existing.minute = liveMatch.minute;
        existing.period = liveMatch.period;
        existing.periodNum = liveMatch.periodNum;
        existing.rawClock = liveMatch.rawClock;
        existing.clockUpdatedAt = liveMatch.clockUpdatedAt || Date.now();
      } else {
        if (!liveMatch.clockUpdatedAt) {
          liveMatch.clockUpdatedAt = Date.now();
        }
        matches.value.unshift(liveMatch);
        markMatchUpdated(liveMatch.id);
      }
    }
  }

  function handleGoal(goalData: GoalEventData) {
    activeGoalAlert.value = goalData;
    markMatchUpdated(goalData.matchId);

    setTimeout(() => {
      if (activeGoalAlert.value?.timestamp === goalData.timestamp) {
        activeGoalAlert.value = null;
      }
    }, 6000);
  }

  function handleMatchUpdate(update: MatchUpdateData) {
    const existing = matches.value.find((m) => m.id === update.match.id);
    if (existing) {
      Object.assign(existing, update.match);
      if (!existing.clockUpdatedAt) {
        existing.clockUpdatedAt = Date.now();
      }
      markMatchUpdated(update.match.id);
    }
  }

  function startLiveStream(matchId?: string) {
    sseStatus.value = 'connecting';
    liveSseClient.connect({
      onOpen: () => {
        isSseConnected.value = true;
        sseStatus.value = 'connected';
      },
      onConnected: () => {
        isSseConnected.value = true;
        sseStatus.value = 'connected';
      },
      onInit: (data) => {
        if (data.matches && Array.isArray(data.matches)) {
          handleLiveScoresUpdate(data.matches);
        }
      },
      onLiveScores: (data) => {
        if (data.matches && Array.isArray(data.matches)) {
          handleLiveScoresUpdate(data.matches);
        }
      },
      onGoal: (data) => {
        handleGoal(data);
      },
      onMatchUpdate: (data) => {
        handleMatchUpdate(data);
      },
      onError: () => {
        isSseConnected.value = false;
        sseStatus.value = 'connecting';
      },
      onClose: () => {
        isSseConnected.value = false;
        sseStatus.value = 'disconnected';
      },
    }, matchId);
  }

  function stopLiveStream() {
    liveSseClient.disconnect();
    isSseConnected.value = false;
    sseStatus.value = 'disconnected';
  }

  function dismissGoalAlert() {
    activeGoalAlert.value = null;
  }

  async function triggerTestGoal(matchId?: string) {
    return await simulateTestGoal(matchId);
  }

  return {
    matches,
    leagues,
    countries,
    selectedCountry,
    selectedDate,
    selectedMonth,
    selectedSeason,
    selectedSport,
    selectedLeague,
    searchQuery,
    statusFilter,
    favorites,
    isLoading,
    isRefreshing,
    isSseConnected,
    sseStatus,
    lastSseTimestamp,
    activeGoalAlert,
    updatedMatchIds,
    tickerTime,
    startMinuteTicker,
    stopMinuteTicker,
    liveMatches,
    liveCount,
    heroMatch,
    filteredMatches,
    groupedByLeague,
    isFavorite,
    toggleFavorite,
    loadMatches,
    loadCountries,
    loadLeagues,
    setCountry,
    startLiveStream,
    stopLiveStream,
    handleGoal,
    handleMatchUpdate,
    handleLiveScoresUpdate,
    dismissGoalAlert,
    triggerTestGoal,
  };
});
