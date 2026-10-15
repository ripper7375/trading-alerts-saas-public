/** Regular schedules only. No official exchange-holiday calendar is asserted. */
import type { GoldMarket } from './catalog';

const formatters = new Map<string, Intl.DateTimeFormat>();
export function localParts(
  now: Date,
  timeZone: string
): { date: string; minutes: number } {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === name)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function scheduledDay(market: GoldMarket, date: string): boolean {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return market.daily === true || (weekday >= 1 && weekday <= 5);
}
/** Resolve a local wall time with IANA timezone rules, including London's/Central Europe's DST. */
export function localTimeToUtc(
  date: string,
  minutes: number,
  timeZone: string
): Date {
  const target = Date.parse(`${date}T00:00:00Z`) + minutes * 60000;
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const actual = localParts(new Date(guess), timeZone);
    const actualWall =
      Date.parse(`${actual.date}T00:00:00Z`) + actual.minutes * 60000;
    const delta = target - actualWall;
    guess += delta;
    if (delta === 0) break;
  }
  return new Date(guess);
}
export function previousScheduledDate(
  market: GoldMarket,
  localDate: string
): string {
  let date = shiftDate(localDate, -1);
  while (!scheduledDay(market, date)) date = shiftDate(date, -1);
  return date;
}
export function getMarketSchedule(
  market: GoldMarket,
  now: Date
): {
  isOpen: boolean;
  localDate: string;
  benchmarkCloseAt: string;
} {
  const local = localParts(now, market.timeZone);
  const weekday = new Date(`${local.date}T12:00:00Z`).getUTCDay();
  const isOpen = market.sessions.some((session) => {
    const start =
      weekday === 5
        ? (session.fridayStartMinutes ?? session.startMinutes)
        : session.startMinutes;
    if (!session.overnight)
      return (
        scheduledDay(market, local.date) &&
        local.minutes >= start &&
        local.minutes < session.endMinutes
      );
    return (
      (scheduledDay(market, local.date) && local.minutes >= start) ||
      (scheduledDay(market, shiftDate(local.date, -1)) &&
        local.minutes < session.endMinutes)
    );
  });
  return {
    isOpen,
    localDate: local.date,
    benchmarkCloseAt: localTimeToUtc(
      local.date,
      market.closeMinutes,
      market.timeZone
    ).toISOString(),
  };
}
export function dueCloses(
  market: GoldMarket,
  now: Date
): { date: string; cutoff: Date }[] {
  const localDate = localParts(now, market.timeZone).date;
  const result: { date: string; cutoff: Date }[] = [];
  for (let day = 0; day <= 1; day++) {
    const date = shiftDate(localDate, -day);
    if (!scheduledDay(market, date)) continue;
    const cutoff = localTimeToUtc(date, market.closeMinutes, market.timeZone);
    const age = now.getTime() - cutoff.getTime();
    // Raw observations expire within eight hours; missed older closes cannot be honestly reconstructed.
    if (age >= 0 && age < 8 * 60 * 60 * 1000) result.push({ date, cutoff });
  }
  return result;
}
