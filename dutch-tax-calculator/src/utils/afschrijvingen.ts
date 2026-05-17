import type { AfschrijvingenData, AfschrijvingItem } from '../types';

export function parseAfschrijvingDate(s: string): Date | null {
  if (!s) return null;
  const parts = s.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function getReplacementDate(item: AfschrijvingItem): Date | null {
  const d = parseAfschrijvingDate(item.aankoopdatum);
  if (!d) return null;
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + item.looptijdJaren);
  return r;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 3600 * 1000));
}

/**
 * Inflation-indexed annual deposit for calendar year `year`.
 * M3 = Jan 1 of (year+1) represents the end of the displayed year column.
 * Three cases: first partial year, middle full years, last partial year.
 */
export function jaarDeposit(item: AfschrijvingItem, rate: number, year: number): number {
  const purchase = parseAfschrijvingDate(item.aankoopdatum);
  const replace  = getReplacementDate(item);
  if (!purchase || !replace || !item.aankoopprijs || !item.looptijdJaren) return 0;

  const M3 = new Date(year + 1, 0, 1);
  const L3 = new Date(year, 0, 1);

  if (M3 <= purchase) return 0;

  const daysMD    = daysBetween(purchase, M3);
  const daysLM    = daysBetween(L3, M3);
  const daysMJ    = daysBetween(replace, M3);
  const baseDaily = item.aankoopprijs / (item.looptijdJaren * 365);

  if (daysMD < 364) {
    return daysMD * baseDaily * (1 + rate);
  }
  if (M3 <= replace) {
    const yearsElapsed = (year + 1) - purchase.getFullYear();
    return daysLM * baseDaily * Math.pow(1 + rate, yearsElapsed);
  }
  if (daysMJ < 364) {
    return (365 - daysMJ) * baseDaily * (1 + rate);
  }
  return 0;
}

/** Sum of deposits from purchase year up to and including upToYear. */
export function gereserveerdTotNu(item: AfschrijvingItem, rate: number, upToYear: number): number {
  const purchase = parseAfschrijvingDate(item.aankoopdatum);
  if (!purchase) return 0;
  const startYear = purchase.getFullYear();
  let total = 0;
  for (let y = startYear; y <= upToYear; y++) total += jaarDeposit(item, rate, y);
  return total;
}

/** Sum of all year deposits (= target "bedrag voor vervanging"). */
export function totalVervanging(item: AfschrijvingItem, rate: number): number {
  const purchase = parseAfschrijvingDate(item.aankoopdatum);
  const replace  = getReplacementDate(item);
  if (!purchase || !replace) return 0;
  let total = 0;
  for (let y = purchase.getFullYear(); y <= replace.getFullYear(); y++) {
    total += jaarDeposit(item, rate, y);
  }
  return total;
}

/**
 * Total reserved across all items in all categories, as of Jan 1 of taxYear.
 * Box 3 peildatum = Jan 1, so we sum deposits through (taxYear − 1).
 */
export function totalAfschrijvingenGereserveerd(data: AfschrijvingenData, taxYear: number): number {
  const rate = data.rentePercentage / 100;
  return data.categorieen
    .flatMap(c => c.items)
    .filter(item => item.enabled !== false)
    .reduce((sum, item) => sum + gereserveerdTotNu(item, rate, taxYear - 1), 0);
}

/**
 * Reserved amount for a single item as of a specific date (for current net worth).
 * Respects the enabled flag and counts only deposits accrued up to `asOf`.
 */
export function gereserveerdTotDatum(item: AfschrijvingItem, rate: number, asOf: Date): number {
  if (item.enabled === false) return 0;
  const purchase = parseAfschrijvingDate(item.aankoopdatum);
  if (!purchase || !item.aankoopprijs || !item.looptijdJaren) return 0;
  const replace = getReplacementDate(item);
  if (!replace) return 0;

  const asOfMs     = asOf.getTime();
  const purchaseMs = purchase.getTime();
  if (asOfMs <= purchaseMs) return 0;

  const replaceMs  = replace.getTime();
  const purchaseYr = purchase.getFullYear();
  const currentYr  = asOf.getFullYear();

  // Sum full completed years (purchase year up to currentYr - 1)
  let total = 0;
  for (let y = purchaseYr; y < currentYr; y++) total += jaarDeposit(item, rate, y);

  // Add partial deposit for the current year (Jan 1, currentYr → asOf)
  const L3ms      = Date.UTC(currentYr, 0, 1);
  const baseDaily = item.aankoopprijs / (item.looptijdJaren * 365);
  const daysMD    = (asOfMs - purchaseMs) / 86400000;

  if (daysMD < 364) {
    // Still within the first partial year since purchase
    total += daysMD * baseDaily * (1 + rate);
  } else if (asOfMs <= replaceMs) {
    const daysLM       = (asOfMs - L3ms) / 86400000;
    const yearsElapsed = currentYr - purchaseYr;
    total += daysLM * baseDaily * Math.pow(1 + rate, yearsElapsed);
  } else {
    const daysMJ = (asOfMs - replaceMs) / 86400000;
    if (daysMJ < 364) total += (365 - daysMJ) * baseDaily * (1 + rate);
  }

  return total;
}
