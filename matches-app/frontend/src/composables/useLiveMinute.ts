import { computed, type Ref, isRef } from 'vue';
import type { SportMatch } from '../types/matches';
import { getLiveMatchMinute, type LiveMinuteResult } from '../utils/liveMinute';
import { useMatchesStore } from '../stores/matches';

export function useLiveMinute(matchSource: SportMatch | Ref<SportMatch | null | undefined>) {
  const store = useMatchesStore();

  const matchData = computed<SportMatch | null>(() => {
    if (isRef(matchSource)) {
      return matchSource.value || null;
    }
    return matchSource || null;
  });

  const minuteInfo = computed<LiveMinuteResult>(() => {
    const match = matchData.value;
    if (!match) {
      return {
        displayMinute: '--',
        periodLabel: '',
        isLive: false,
        isHalfTime: false,
        isStoppage: false,
        isFinished: false,
        isUpcoming: false,
      };
    }
    // store.tickerTime réagit chaque seconde !
    return getLiveMatchMinute(match, store.tickerTime);
  });

  return {
    minuteInfo,
    displayMinute: computed(() => minuteInfo.value.displayMinute),
    periodLabel: computed(() => minuteInfo.value.periodLabel),
    isLive: computed(() => minuteInfo.value.isLive),
    isHalfTime: computed(() => minuteInfo.value.isHalfTime),
    isStoppage: computed(() => minuteInfo.value.isStoppage),
    isFinished: computed(() => minuteInfo.value.isFinished),
    isUpcoming: computed(() => minuteInfo.value.isUpcoming),
  };
}
