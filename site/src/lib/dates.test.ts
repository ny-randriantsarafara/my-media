import { describe, expect, it } from 'vitest';
import { formatCalendarDate, formatEditionDate, formatLongDate, formatShortDate, toDateTimeAttribute } from './dates.ts';

describe('French dates', () => {
  it('formats a publication date in Paris time', () => {
    expect(formatLongDate(new Date('2026-10-10T08:30:00.000Z'))).toBe('10 octobre 2026');
  });

  it('uses the Paris calendar day near midnight', () => {
    expect(formatLongDate(new Date('2026-10-10T23:30:00.000Z'))).toBe('11 octobre 2026');
  });

  it('formats a short date for lists', () => {
    expect(formatShortDate(new Date('2026-10-10T08:30:00.000Z'))).toBe('10 oct.');
  });

  it('formats the edition date with a capitalised weekday', () => {
    expect(formatEditionDate(new Date('2026-10-10T08:30:00.000Z'))).toBe('Samedi 10 octobre 2026');
  });

  it('formats a document date without shifting the day', () => {
    expect(formatCalendarDate('2026-03-12')).toBe('12 mars 2026');
  });

  it('exposes a machine-readable datetime attribute', () => {
    expect(toDateTimeAttribute(new Date('2026-10-10T08:30:00.000Z'))).toBe('2026-10-10T08:30:00.000Z');
  });
});
