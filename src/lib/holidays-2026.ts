/**
 * Holidays and observances for 2026.
 * Used to show "Holidays in the next 30 days" on Circle of People.
 * Dates are YYYY-MM-DD. Add or update annually.
 */

export interface HolidayEntry {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD
}

export const HOLIDAYS_2026: HolidayEntry[] = [
  { id: "new-years-2026", label: "New Year's Day", date: "2026-01-01" },
  { id: "valentines-2026", label: "Valentine's Day", date: "2026-02-14" },
  { id: "ash-wednesday-2026", label: "Ash Wednesday / Lent begins (Christian)", date: "2026-02-18" },
  { id: "ramadan-start-2026", label: "Ramadan begins (Islamic)", date: "2026-02-18" },
  { id: "eid-al-fitr-2026", label: "Eid al-Fitr (Islamic)", date: "2026-03-20" },
  { id: "passover-2026", label: "Passover begins (Jewish)", date: "2026-04-01" },
  { id: "easter-2026", label: "Easter (Christian)", date: "2026-04-05" },
  { id: "mothers-day-2026", label: "Mother's Day (US)", date: "2026-05-10" },
  { id: "fathers-day-2026", label: "Father's Day (US)", date: "2026-06-21" },
  { id: "july-fourth-2026", label: "Independence Day (US)", date: "2026-07-04" },
  { id: "diwali-2026", label: "Diwali (Hindu)", date: "2026-10-20" },
  { id: "halloween-2026", label: "Halloween", date: "2026-10-31" },
  { id: "thanksgiving-2026", label: "Thanksgiving (US)", date: "2026-11-26" },
  { id: "hanukkah-2026", label: "Hanukkah begins (Jewish)", date: "2026-12-04" },
  { id: "christmas-2026", label: "Christmas (Christian)", date: "2026-12-25" },
];
