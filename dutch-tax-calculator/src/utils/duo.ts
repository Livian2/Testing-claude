import type { SchuldItem } from '../types';

// ── DUO 2026 parameters ────────────────────────────────────────────────────
// Draagkrachtvrije voet: 84% of the statutory minimum wage (wettelijk minimumloon)
// WML 2026 single (incl. 8% vakantiegeld): ≈ €28,866/jr → 84% ≈ €24,248
// Partner norm (≈ 143% WML incl. vakantiegeld): ≈ €40,246/jr → 84% ≈ €33,807
// Both SF15 and SF35 use the same threshold; only the looptijd differs (15 vs 35 yr).
export const DUO_DRAAGKRACHT_VRIJ         = 24_248;  // threshold below which you pay nothing (single)
export const DUO_DRAAGKRACHT_PCT          = 0.04;    // 4% of income above threshold
export const DUO_DRAAGKRACHT_PARTNER_VRIJ = 33_807;  // higher threshold for partners

/**
 * Annual DUO repayment based on (fiscal) income.
 * Returns the gross annual payment amount (includes interest component).
 */
export function berekenDuoJaarbetaling(
  toetsingsinkomen: number,
  isPartner = false,
): number {
  const drempel = isPartner ? DUO_DRAAGKRACHT_PARTNER_VRIJ : DUO_DRAAGKRACHT_VRIJ;
  return Math.max(0, (toetsingsinkomen - drempel) * DUO_DRAAGKRACHT_PCT);
}

export interface DuoJaarPunt {
  jaar: number;
  balans: number;       // remaining debt at start of year
  betaling: number;     // payment made during year
  rente: number;        // interest charged during year
  inkomen: number;      // income used for calculation
  kwijtgescholden: boolean;
}

export interface DuoSimulatie {
  punten: DuoJaarPunt[];
  eindBalans: number;
  kwijtscheldingsBedrag: number;
  betaaldTotaal: number;
  renteTotaal: number;
  afgelosdJaar: number | null; // year fully repaid (null = not within simulation)
}

/**
 * Simulate full DUO repayment year-by-year.
 *
 * @param schuld        The DUO SchuldItem
 * @param startInkomen  Gross salary in the first simulation year
 * @param inkomensstijging  Annual income growth as a decimal (e.g. 0.02 = 2%)
 * @param startJaar     First year to simulate from (e.g. taxYear)
 * @param isPartner     Use partner draagkrachtvrije voet
 */
export function simuleerDuo(
  schuld: SchuldItem,
  startInkomen: number,
  inkomensstijging: number,
  startJaar: number,
  isPartner = false,
): DuoSimulatie {
  const aflossStart   = schuld.aflossingsStartJaar ?? schuld.startJaar;
  const aflossEind    = aflossStart + schuld.looptijd;  // write-off after looptijd years
  const rente         = schuld.rentePercentage / 100;
  const maxJaren      = Math.max(schuld.looptijd + (aflossStart - startJaar) + 5, 40);

  let balans         = schuld.bedrag;
  let betaaldTotaal  = 0;
  let renteTotaal    = 0;
  let afgelosdJaar: number | null = null;
  const punten: DuoJaarPunt[] = [];

  for (let i = 0; i <= maxJaren; i++) {
    const jaar    = startJaar + i;
    const inkomen = startInkomen * Math.pow(1 + inkomensstijging, i);

    if (balans <= 0) {
      punten.push({ jaar, balans: 0, betaling: 0, rente: 0, inkomen, kwijtgescholden: false });
      break;
    }

    // After write-off deadline: remaining debt is cancelled
    if (jaar >= aflossEind) {
      const kwijtBedrag = balans;
      punten.push({ jaar, balans, betaling: 0, rente: 0, inkomen, kwijtgescholden: true });
      balans = 0;
      punten.push({ jaar: jaar + 1, balans: 0, betaling: 0, rente: 0, inkomen, kwijtgescholden: false });
      return {
        punten, eindBalans: 0,
        kwijtscheldingsBedrag: kwijtBedrag,
        betaaldTotaal, renteTotaal, afgelosdJaar,
      };
    }

    // Before repayment start: balance is unchanged (bedrag IS the balance at aflossStart)
    if (jaar < aflossStart) {
      punten.push({ jaar, balans: schuld.bedrag, betaling: 0, rente: 0, inkomen, kwijtgescholden: false });
      continue;
    }

    // Repayment period
    const jaarRente   = balans * rente;
    const jaarbetaling = berekenDuoJaarbetaling(inkomen, isPartner);
    // Payment covers interest first, then principal
    const effectief   = Math.min(jaarbetaling, balans + jaarRente);
    const principal   = Math.max(0, effectief - jaarRente);

    renteTotaal  += jaarRente;
    betaaldTotaal += effectief;
    balans        = Math.max(0, balans + jaarRente - effectief);

    punten.push({ jaar, balans: balans + principal, betaling: effectief, rente: jaarRente, inkomen, kwijtgescholden: false });

    if (balans <= 0) {
      afgelosdJaar = jaar;
      punten.push({ jaar: jaar + 1, balans: 0, betaling: 0, rente: 0, inkomen, kwijtgescholden: false });
      break;
    }
  }

  return {
    punten,
    eindBalans:            balans,
    kwijtscheldingsBedrag: 0,
    betaaldTotaal,
    renteTotaal,
    afgelosdJaar,
  };
}
