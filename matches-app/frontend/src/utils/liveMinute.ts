import type { SportMatch } from '../types/matches';

export interface LiveMinuteResult {
  displayMinute: string; // ex: "54'", "45'+2", "MT", "FT", "21:00"
  periodLabel: string;  // ex: "1ère MT", "2ème MT", "Mi-temps", "Terminé", "À venir", "Prol."
  isLive: boolean;
  isHalfTime: boolean;
  isStoppage: boolean;
  isFinished: boolean;
  isUpcoming: boolean;
  currentMinuteNumber?: number;
}

function formatKickoffTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
}

/**
 * Calcule avec précision la minute d'un match en temps réel.
 * Prend en compte l'horloge officielle de l'API (ESPN), l'horodatage de réception,
 * et avance les minutes seconde par seconde / minute par minute.
 */
export function getLiveMatchMinute(match: SportMatch, currentTimestamp: number = Date.now()): LiveMinuteResult {
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';

  // 1. Matches non-live
  if (!isLive) {
    if (isFinished) {
      return {
        displayMinute: match.statusShort || 'FT',
        periodLabel: 'Terminé',
        isLive: false,
        isHalfTime: false,
        isStoppage: false,
        isFinished: true,
        isUpcoming: false,
      };
    }
    if (match.status === 'postponed') {
      return {
        displayMinute: 'REP.',
        periodLabel: 'Reporté',
        isLive: false,
        isHalfTime: false,
        isStoppage: false,
        isFinished: false,
        isUpcoming: false,
      };
    }
    if (match.status === 'cancelled') {
      return {
        displayMinute: 'ANN.',
        periodLabel: 'Annulé',
        isLive: false,
        isHalfTime: false,
        isStoppage: false,
        isFinished: false,
        isUpcoming: false,
      };
    }
    return {
      displayMinute: formatKickoffTime(match.startTime),
      periodLabel: 'À venir',
      isLive: false,
      isHalfTime: false,
      isStoppage: false,
      isFinished: false,
      isUpcoming: true,
    };
  }

  // 2. Détection Mi-Temps (MT / HT)
  const sShort = (match.statusShort || '').toUpperCase();
  const sText = (match.statusText || '').toLowerCase();
  const mText = (match.minute || '').toUpperCase();
  const isHalfTime =
    sShort === 'MT' ||
    sShort === 'HT' ||
    mText === 'MT' ||
    mText === 'HT' ||
    sText.includes('half') ||
    sText.includes('mi-temps');

  if (isHalfTime) {
    return {
      displayMinute: 'MT',
      periodLabel: 'Mi-temps',
      isLive: true,
      isHalfTime: true,
      isStoppage: false,
      isFinished: false,
      isUpcoming: false,
      currentMinuteNumber: 45,
    };
  }

  // 3. Détection Tirs au but / Séances
  if (sShort === 'TAB' || sShort === 'PEN' || sText.includes('shootout') || sText.includes('penalty')) {
    return {
      displayMinute: 'TAB',
      periodLabel: 'Tirs au but',
      isLive: true,
      isHalfTime: false,
      isStoppage: false,
      isFinished: false,
      isUpcoming: false,
      currentMinuteNumber: 120,
    };
  }

  // 4. Calcul du temps écoulé depuis la dernière mise à jour
  const refTime = match.clockUpdatedAt || match.startTimestamp || currentTimestamp;
  const elapsedMs = Math.max(0, currentTimestamp - refTime);
  const diffMinutes = Math.floor(elapsedMs / 60000);

  const rawMinuteStr = (match.minute || match.statusShort || '').trim();

  // A. Format temps additionnel explicite (ex: "45'+2", "45+3", "90'+4")
  const stoppageMatch = rawMinuteStr.match(/^(\d+)['\s]*\+(\d+)['\s]*$/);
  if (stoppageMatch) {
    const base = parseInt(stoppageMatch[1], 10);
    const initialStoppage = parseInt(stoppageMatch[2], 10);
    const currentStoppage = initialStoppage + diffMinutes;
    const periodLabel = base <= 45 ? '1ère MT' : base <= 90 ? '2ème MT' : 'Prol.';
    return {
      displayMinute: `${base}'+${currentStoppage}`,
      periodLabel,
      isLive: true,
      isHalfTime: false,
      isStoppage: true,
      isFinished: false,
      isUpcoming: false,
      currentMinuteNumber: base + currentStoppage,
    };
  }

  // B. Format standard avec minutes (ex: "54'", "54", "54:00")
  const minuteNumberMatch = rawMinuteStr.match(/^(\d+)/);
  if (minuteNumberMatch) {
    const baseMin = parseInt(minuteNumberMatch[1], 10);
    const computedMin = baseMin + diffMinutes;
    const isPeriod1 = match.periodNum === 1 || (!match.periodNum && baseMin <= 45);
    const isPeriod2 = match.periodNum === 2 || (!match.periodNum && baseMin > 45 && baseMin <= 90);

    if (isPeriod1) {
      if (computedMin <= 45) {
        return {
          displayMinute: `${computedMin}'`,
          periodLabel: '1ère MT',
          isLive: true,
          isHalfTime: false,
          isStoppage: false,
          isFinished: false,
          isUpcoming: false,
          currentMinuteNumber: computedMin,
        };
      }
      return {
        displayMinute: `45'+${computedMin - 45}`,
        periodLabel: '1ère MT',
        isLive: true,
        isHalfTime: false,
        isStoppage: true,
        isFinished: false,
        isUpcoming: false,
        currentMinuteNumber: computedMin,
      };
    }

    if (isPeriod2) {
      if (computedMin <= 90) {
        return {
          displayMinute: `${computedMin}'`,
          periodLabel: '2ème MT',
          isLive: true,
          isHalfTime: false,
          isStoppage: false,
          isFinished: false,
          isUpcoming: false,
          currentMinuteNumber: computedMin,
        };
      }
      return {
        displayMinute: `90'+${computedMin - 90}`,
        periodLabel: '2ème MT',
        isLive: true,
        isHalfTime: false,
        isStoppage: true,
        isFinished: false,
        isUpcoming: false,
        currentMinuteNumber: computedMin,
      };
    }

    // Prolongations
    if (computedMin <= 120) {
      return {
        displayMinute: `${computedMin}'`,
        periodLabel: 'Prol.',
        isLive: true,
        isHalfTime: false,
        isStoppage: false,
        isFinished: false,
        isUpcoming: false,
        currentMinuteNumber: computedMin,
      };
    }
    return {
      displayMinute: `120'+${computedMin - 120}`,
      periodLabel: 'Prol.',
      isLive: true,
      isHalfTime: false,
      isStoppage: true,
      isFinished: false,
      isUpcoming: false,
      currentMinuteNumber: computedMin,
    };
  }

  // C. Fallback si aucune minute reçue mais match en direct (estimation kickoff)
  if (match.startTime) {
    const kickoffMs = new Date(match.startTime).getTime();
    if (!isNaN(kickoffMs)) {
      const elapsedSinceKickoff = Math.floor(Math.max(0, currentTimestamp - kickoffMs) / 60000);
      if (elapsedSinceKickoff <= 45) {
        const min = Math.max(1, elapsedSinceKickoff);
        return {
          displayMinute: `${min}'`,
          periodLabel: '1ère MT',
          isLive: true,
          isHalfTime: false,
          isStoppage: false,
          isFinished: false,
          isUpcoming: false,
          currentMinuteNumber: min,
        };
      }
      if (elapsedSinceKickoff <= 60) {
        return {
          displayMinute: 'MT',
          periodLabel: 'Mi-temps',
          isLive: true,
          isHalfTime: true,
          isStoppage: false,
          isFinished: false,
          isUpcoming: false,
          currentMinuteNumber: 45,
        };
      }
      if (elapsedSinceKickoff <= 105) {
        const min = Math.min(90, Math.max(46, elapsedSinceKickoff - 15));
        return {
          displayMinute: `${min}'`,
          periodLabel: '2ème MT',
          isLive: true,
          isHalfTime: false,
          isStoppage: false,
          isFinished: false,
          isUpcoming: false,
          currentMinuteNumber: min,
        };
      }
      return {
        displayMinute: `90'+${elapsedSinceKickoff - 105}`,
        periodLabel: '2ème MT',
        isLive: true,
        isHalfTime: false,
        isStoppage: true,
        isFinished: false,
        isUpcoming: false,
        currentMinuteNumber: elapsedSinceKickoff - 15,
      };
    }
  }

  // D. Fallback ultime
  return {
    displayMinute: rawMinuteStr || 'LIVE',
    periodLabel: 'En direct',
    isLive: true,
    isHalfTime: false,
    isStoppage: false,
    isFinished: false,
    isUpcoming: false,
  };
}
