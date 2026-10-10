const PARIS_TIME_ZONE = 'Europe/Paris';

const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: PARIS_TIME_ZONE });
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: PARIS_TIME_ZONE });
const editionDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: PARIS_TIME_ZONE,
});
const calendarDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatLongDate(date: Date): string {
  return longDate.format(date);
}

export function formatShortDate(date: Date): string {
  return shortDate.format(date);
}

export function formatEditionDate(date: Date): string {
  const text = editionDate.format(date);
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export function formatCalendarDate(isoDate: string): string {
  return calendarDate.format(new Date(`${isoDate}T00:00:00.000Z`));
}

export function toDateTimeAttribute(date: Date): string {
  return date.toISOString();
}
