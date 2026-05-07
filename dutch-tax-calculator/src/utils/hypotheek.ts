import type { HypotheekData } from '../types';

export interface HypotheekBerekening {
  maandlast: number;
  jaarRente: number;       // aftrekbaar in Box 1
  jaarAflossing: number;
  restschuldBegin: number;
  restschuldEind: number;
}

export function berekenHypotheek(h: HypotheekData, taxYear: number): HypotheekBerekening {
  const { leningBedrag, rentePercentage, looptijd, startJaar } = h;
  if (leningBedrag <= 0 || looptijd <= 0) {
    return { maandlast: 0, jaarRente: 0, jaarAflossing: 0, restschuldBegin: leningBedrag, restschuldEind: leningBedrag };
  }

  const r = rentePercentage / 100;
  const jaarInLening = Math.max(0, taxYear - startJaar);

  if (h.type === 'aflossingsvrijij') {
    const maandRente = (leningBedrag * r) / 12;
    return {
      maandlast: maandRente,
      jaarRente: leningBedrag * r,
      jaarAflossing: 0,
      restschuldBegin: leningBedrag,
      restschuldEind: leningBedrag,
    };
  }

  if (h.type === 'lineair') {
    const maandAflossing = leningBedrag / (looptijd * 12);
    const restschuldBegin = Math.max(0, leningBedrag - jaarInLening * 12 * maandAflossing);
    const restschuldEind  = Math.max(0, restschuldBegin - 12 * maandAflossing);

    // Average debt during the year × rate = annual interest
    const jaarRente = ((restschuldBegin + restschuldEind) / 2) * r;

    // Representative monthly payment = midpoint month interest + fixed repayment
    const midMonthDebt = (restschuldBegin + restschuldEind) / 2;
    const maandlast = midMonthDebt * (r / 12) + maandAflossing;

    return {
      maandlast,
      jaarRente,
      jaarAflossing: 12 * maandAflossing,
      restschuldBegin,
      restschuldEind,
    };
  }

  // annuiteit
  const rm = r / 12;
  const n  = looptijd * 12;
  const annuity = rm > 0
    ? leningBedrag * (rm * Math.pow(1 + rm, n)) / (Math.pow(1 + rm, n) - 1)
    : leningBedrag / n;

  // Build up to start of tax year
  let restschuld = leningBedrag;
  for (let m = 0; m < jaarInLening * 12; m++) {
    const interest = restschuld * rm;
    restschuld = Math.max(0, restschuld - (annuity - interest));
  }

  const restschuldBegin = restschuld;
  let jaarRente = 0;
  let jaarAflossing = 0;

  for (let m = 0; m < 12; m++) {
    const interest = restschuld * rm;
    const aflossing = Math.min(annuity - interest, restschuld);
    jaarRente    += interest;
    jaarAflossing += aflossing;
    restschuld    = Math.max(0, restschuld - aflossing);
  }

  return {
    maandlast: annuity,
    jaarRente,
    jaarAflossing,
    restschuldBegin,
    restschuldEind: restschuld,
  };
}
