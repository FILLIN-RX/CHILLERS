function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isWithinScrapingHours(): boolean {
  const now = new Date();
  const localHour = (now.getUTCHours() + 1) % 24;
  const localDay = now.getUTCDay();
  const isWeekend = localDay === 0 || localDay === 6;
  const startHour = isWeekend ? 11 : 9;
  const endHour = 20;
  return localHour >= startHour && localHour < endHour;
}

export function getScheduleLabel(): string {
  const now = new Date();
  const localDay = now.getUTCDay();
  const isWeekend = localDay === 0 || localDay === 6;
  return isWeekend ? '11h-20h (Sam-Dim)' : '9h-20h (Lun-Ven)';
}

export async function waitForScrapingHours(): Promise<void> {
  while (!isWithinScrapingHours()) {
    console.log(`[PlageHoraire] Hors plage autorisée ${getScheduleLabel()} — attente 60s...`);
    await sleep(60000);
  }
}
