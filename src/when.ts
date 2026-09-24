/**
 * When something was said, as short as it can be said: the time for today,
 * the weekday within the week, the date before that. Timestamps are seconds
 * since the epoch, as DIDComm writes them.
 */
export function when(seconds: number, locale: string, now: Date = new Date()): string {
  const date = new Date(seconds * 1000);
  if (sameDay(date, now)) {
    return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
  }
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  if (days < 6 && days > 0) {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(date);
}

/** The moment of one message: the time, with the date when it is not today's. */
export function moment(seconds: number, locale: string, now: Date = new Date()): string {
  const date = new Date(seconds * 1000);
  return new Intl.DateTimeFormat(
    locale,
    sameDay(date, now) ? { timeStyle: "short" } : { dateStyle: "short", timeStyle: "short" },
  ).format(date);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
