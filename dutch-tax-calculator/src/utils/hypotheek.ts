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
  const startMaand = h.startMaand ?? 1;
  if (leningBedrag <= 0 || looptijd <= 0) {
    return { maandlast: 0, jaarRente: 0, jaarAflossing: 0, restschuldBegin: leningBedrag, restschuldEind: leningBedrag };
  }

  const r  = rentePercentage / 100;
  const rm = r / 12;
  const n  = looptijd; // looptijd is opgeslagen in maanden
  // months from loan start to Jan 1 of taxYear
  const preMonths    = Math.max(0, (taxYear - startJaar) * 12 - (startMaand - 1));
  // months of loan active during taxYear
  const taxYearMonths = taxYear < startJaar ? 0
    : taxYear === startJaar ? (13 - startMaand)
    : 12;
  const extraMonthly = Math.max(0, h.extraAflossingMaandelijks ?? 0);

  // Pre-compute fixed schedule values
  const baseLinearAflossing = leningBedrag / n;
  const baseAnnuity = rm > 0
    ? leningBedrag * (rm * Math.pow(1 + rm, n)) / (Math.pow(1 + rm, n) - 1)
    : leningBedrag / n;

  // Simulate one month: extra paid on the 15th (interest accrues half-month on full
  // balance, half-month on reduced balance). Returns interest, total principal paid,
  // total payment for that month. Mutates `state.balance`.
  const state = { balance: leningBedrag };
  function stepMonth(): { interest: number; principal: number; payment: number } {
    if (state.balance <= 0) return { interest: 0, principal: 0, payment: 0 };
    const extra = Math.min(extraMonthly, state.balance);
    // Day-15 mid-month payment: half-month at full balance, half-month at reduced balance
    const interest = (state.balance * rm) / 2 + ((state.balance - extra) * rm) / 2;
    state.balance -= extra;

    let regular = 0;
    let payment = 0;
    if (h.type === 'aflossingsvrijij') {
      regular = 0;
      payment = interest + extra;
    } else if (h.type === 'lineair') {
      regular = Math.min(baseLinearAflossing, state.balance);
      payment = interest + regular + extra;
    } else {
      // annuiteit: fixed monthly payment, principal portion = annuity - month-start interest
      const standardInterest = (state.balance + extra) * rm;
      regular = Math.min(Math.max(0, baseAnnuity - standardInterest), state.balance);
      payment = baseAnnuity + extra;
    }
    state.balance = Math.max(0, state.balance - regular);
    return { interest, principal: regular + extra, payment };
  }

  // Simulate up to start of tax year
  for (let m = 0; m < preMonths; m++) stepMonth();

  const restschuldBegin = state.balance;
  let jaarRente = 0;
  let jaarAflossing = 0;
  let firstMonthPayment = 0;

  for (let m = 0; m < taxYearMonths; m++) {
    const r = stepMonth();
    if (m === 0) firstMonthPayment = r.payment;
    jaarRente     += r.interest;
    jaarAflossing += r.principal;
  }

  return {
    maandlast: firstMonthPayment,
    jaarRente,
    jaarAflossing,
    restschuldBegin,
    restschuldEind: state.balance,
  };
}
