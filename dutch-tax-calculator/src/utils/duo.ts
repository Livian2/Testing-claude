import type { SchuldItem } from '../types';

// ── DUO 2026 parameters ────────────────────────────────────────────────────
// Draagkrachtvrije voet: 84% of the statutory minimum wage (wettelijk minimumloon)
// WML 2026 single (incl. 8% vakantiegeld): ≈ €28,866/jr → 84% ≈ €24,248
// Partner norm (≈ 143% WML incl. vakantiegeld): ≈ €40,246/jr → 84% ≈ €33,807
export const DUO_DRAAGKRACHT_VRIJ         = 24_248;
export const DUO_DRAAGKRACHT_PCT          = 0.04;
export const DUO_DRAAGKRACHT_PARTNER_VRIJ = 33_807;

/**
 * Annual DUO repayment based on (fiscal) income.
 * 4% of income above the draagkrachtvrije voet.
 */
export function berekenDuoJaarbetaling(
  toetsingsinkomen: number,
  isPartner = false,
): number {
  const drempel = isPartner ? DUO_DRAAGKRACHT_PARTNER_VRIJ : DUO_DRAAGKRACHT_VRIJ;
  return Math.max(0, (toetsingsinkomen - drempel) * DUO_DRAAGKRACHT_PCT);
}

export type DuoFase = 'voor-start' | 'lening' | 'aangroei' | 'aflossing' | 'kwijtschelding' | 'afgelost';

export interface DuoJaarPunt {
  jaar: number;
  balans: number;          // remaining debt at start of year
  betaling: number;        // payment made during year
  rente: number;           // interest charged during year
  inkomen: number;         // income used for calculation
  fase: DuoFase;
}

export interface DuoSimulatie {
  punten: DuoJaarPunt[];
  eindBalans: number;
  kwijtscheldingsBedrag: number;
  betaaldTotaal: number;
  renteTotaal: number;
  afgelosdJaar: number | null;
  balansOpAflossStart: number; // balance at start of repayment (after accrual)
}

/**
 * Simulate full DUO lifecycle year-by-year.
 *
 * Phases:
 *  0. leningStartJaar → startJaar   : loan exists, balance flat (bedrag), no interest
 *  1. startJaar → aflossStart       : interest accrues, balance grows, no payment
 *  2. aflossStart → aflossEind      : income-based repayments (4% above drempel)
 *  3. jaar >= aflossEind            : kwijtschelding of remaining balance
 *
 * @param schuld           DUO SchuldItem; bedrag = balance at startJaar (interest start)
 * @param startInkomen     Gross income in taxYear
 * @param inkomensstijging Annual income growth (decimal, e.g. 0.02)
 * @param taxYear          Current tax year (income reference point)
 * @param isPartner        Use partner draagkrachtvrije voet
 */
export function simuleerDuo(
  schuld: SchuldItem,
  startInkomen: number,
  inkomensstijging: number,
  taxYear: number,
  isPartner = false,
): DuoSimulatie {
  const leningStart = schuld.leningStartJaar ?? schuld.startJaar; // loan taken out, balance flat
  const renteStart  = schuld.startJaar;                           // interest starts accruing
  const aflossStart = schuld.aflossingsStartJaar ?? schuld.startJaar;
  const aflossEind  = aflossStart + schuld.looptijd;
  const rente       = schuld.rentePercentage / 100;

  // Chart starts from the earliest of taxYear or leningStart
  const simStart = Math.min(taxYear, leningStart);
  const maxJaren = aflossEind - simStart + 6;

  let balans = schuld.bedrag;
  let betaaldTotaal = 0;
  let renteTotaal = 0;
  let afgelosdJaar: number | null = null;
  let balansOpAflossStart = schuld.bedrag;
  const punten: DuoJaarPunt[] = [];

  for (let i = 0; i <= maxJaren; i++) {
    const jaar   = simStart + i;
    const inkomen = startInkomen * Math.pow(1 + inkomensstijging, jaar - taxYear);

    // Before loan exists
    if (jaar < leningStart) {
      punten.push({ jaar, balans: 0, betaling: 0, rente: 0, inkomen, fase: 'voor-start' });
      continue;
    }

    // Loan taken out but interest not yet active: balance is flat at bedrag
    if (jaar < renteStart) {
      punten.push({ jaar, balans: schuld.bedrag, betaling: 0, rente: 0, inkomen, fase: 'lening' });
      continue;
    }

    if (balans <= 0) {
      punten.push({ jaar, balans: 0, betaling: 0, rente: 0, inkomen, fase: 'afgelost' });
      break;
    }

    // Kwijtschelding year
    if (jaar >= aflossEind) {
      const finalRente = balans * rente;
      renteTotaal += finalRente;
      punten.push({ jaar, balans, betaling: 0, rente: finalRente, inkomen, fase: 'kwijtschelding' });
      punten.push({ jaar: jaar + 1, balans: 0, betaling: 0, rente: 0, inkomen, fase: 'afgelost' });
      return {
        punten, eindBalans: 0,
        kwijtscheldingsBedrag: balans + finalRente,
        betaaldTotaal, renteTotaal, afgelosdJaar, balansOpAflossStart,
      };
    }

    const startBalans = balans;
    const jaarRente   = balans * rente;

    if (jaar < aflossStart) {
      // Grace / accrual period: interest adds to balance, no payment
      renteTotaal += jaarRente;
      balans += jaarRente;
      if (jaar + 1 === aflossStart) balansOpAflossStart = balans;
      punten.push({ jaar, balans: startBalans, betaling: 0, rente: jaarRente, inkomen, fase: 'aangroei' });
      continue;
    }

    // Record balance at start of repayment
    if (jaar === aflossStart) balansOpAflossStart = balans;

    // Repayment: payment covers interest first, then principal
    const jaarbetaling = berekenDuoJaarbetaling(inkomen, isPartner);
    const effectief    = Math.min(jaarbetaling, balans + jaarRente);
    renteTotaal   += jaarRente;
    betaaldTotaal += effectief;
    balans         = Math.max(0, balans + jaarRente - effectief);

    punten.push({ jaar, balans: startBalans, betaling: effectief, rente: jaarRente, inkomen, fase: 'aflossing' });

    if (balans <= 0) {
      afgelosdJaar = jaar;
      punten.push({ jaar: jaar + 1, balans: 0, betaling: 0, rente: 0, inkomen, fase: 'afgelost' });
      break;
    }
  }

  return {
    punten, eindBalans: balans, kwijtscheldingsBedrag: 0,
    betaaldTotaal, renteTotaal, afgelosdJaar, balansOpAflossStart,
  };
}
