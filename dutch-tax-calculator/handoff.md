# Handoff — Dutch Tax Calculator

Branch: `claude/dutch-tax-calculator-wibPq`
Last commit: `f8d9a9d` — Add eigenwoningforfait (EWF) to Box 1 and HRA calculation

---

## Goal

A complete Dutch personal finance / tax calculator for 2026 that covers:
- Box 1 (income tax) with real brackets, heffingskortingen, HRA, and EWF
- Box 3 (wealth tax) with the 2026 fictitious-return model
- Toeslagen (zorgtoeslag, huurtoeslag, hypotheekrenteaftrek)
- Net worth (portfolio + bank accounts − debts − mortgages)
- Cashflow overview with DUO repayment and afschrijvingen sinking fund
- Mortgage amortisation charts
- Portfolio tracking (holdings, transactions, live price fetching)
- Afschrijvingen / sinking fund planner (no year cap)
- Schulden tracker (DUO, beleggingsschulden)
- Bank accounts tab (current balances → net worth)
- Waardes 1 jan tab (informational only, disconnected from all calculations)
- Dark mode, NL/EN toggle, localStorage persistence, JSON import/export

---

## Current State

Everything compiles cleanly (`npx tsc --noEmit` passes).

### What works correctly
- **Box 1**: brackets 35,82% / 37,48% / 49,50% (2026). AHK uses verzamelinkomen. Arbeidskorting uses employment income only.
- **EWF / net HRA**: eigenwoningforfait (0,35% × WOZ, villatarief 2,35% above €1.31M). Net aftrekpost = rente − EWF. Wet Hillen phase-out (7/30 taxable in 2026) when EWF > rente.
- **Box 3**: bankData (spaarrekeningen + betaalrekeningen current balances) + portfolio current value. Afschrijvingen gereserveerd subtracted. Fictitious returns: spaargeld 1,03%, overige bezittingen 5,88%, schulden 2,62%. Tarief 36%.
- **Net worth**: portfolio + bankData − all schulden (duo + beleggingen) − hypotheek restschuld.
- **Cashflow**: grossIncome − box1 − box3 + toeslagen − expenses − DUO jaarbetaling − afschrijvingen jaardeposit = netDisposableIncome. All line items now add up to the displayed total.
- **Toeslagen**: zorgtoeslag (income-tested), huurtoeslag (rent + income-tested), hypotheekrenteaftrek (exact bracket calculation, shown separately, NOT in total to avoid double-count with Box 1 deduction).
- **DUO**: income-based annual repayment via `berekenDuoJaarbetaling(grossIncome, isPartner)`. Only shown when schulden.duo.length > 0.
- **Mortgage chart**: SVG + HTML overlay tooltip, hover to scroll through years. No useRef/useCallback (was causing chart to disappear). Uses `e.currentTarget.getBoundingClientRect()` inline.
- **Waardes 1 jan**: fully disconnected — no calculation reads from `waardes`. `portfolioJan1Value = 0`.
- **InfoTooltip**: `tabIndex={-1}` + `aria-hidden="true"` — not in tab order.
- **Afschrijvingen**: sinking fund with no year cap (removed `max={30}`).

### Known limitations / not yet implemented
- Aflossingsvrije hypotheek aftrekbaarheid: the app calculates rente for all hypotheek types including aflossingsvrij. If the aflossingsvrij part was opened after 2013 without transition rights, the rente is NOT deductible — but the app doesn't model this. It shows an InfoTooltip warning but still includes it in the calculation.
- Box 3 peildatum discrepancy: bankData uses *current* balances for both Box 3 and net worth. The legal Box 3 peildatum is 1 January. Users need to manually enter Jan-1 values — there is currently no separate "Jan-1 bank balances" field.
- Geen kindgebonden budget / kinderopvangtoeslag.
- No "voorlopige aanslag" monthly split view.
- PrognoseConfig / NetWorthProjection exists but may need connecting to updated data model.

---

## File Map

### Core calculation
| File | Role |
|------|------|
| `src/utils/taxCalculations.ts` | Box 1, Box 3, toeslagen, net worth, cashflow. `calcEwf`, `eigenwoningEffect`, `calculateBox1`, `calculateBox3`, `calculateToeslagen`, `calculateTaxes`. |
| `src/utils/hypotheek.ts` | `berekenHypotheek(hyp, year)` → maandlast, jaarRente, jaarAflossing, restschuldBegin |
| `src/utils/duo.ts` | `berekenDuoJaarbetaling(grossIncome, isPartner)` |
| `src/utils/afschrijvingen.ts` | `jaarDeposit`, `gereserveerdTotNu`, `totalAfschrijvingenGereserveerd` |
| `src/utils/priceFetcher.ts` | Yahoo Finance proxy price fetcher |
| `src/utils/csvParser.ts` | DEGIRO / generic CSV import |

### Types
| File | Key types |
|------|-----------|
| `src/types/index.ts` | `TaxFormData`, `WoonData` (includes `wozWaarde`), `BankData`, `BankSpaarRekening`, `BankBetaalRekening`, `TaxResult` (includes `duoJaarbetaling`, `afschrijvingenJaarDeposit`), `Toeslagen` (includes `hypotheekrenteaftrek` separate from `total`) |

### UI components
| File | Tab |
|------|-----|
| `src/App.tsx` | Shell, tabs, DEFAULT_DATA, persistence |
| `src/components/WoonSection.tsx` | Wonen tab — housing type, WOZ, hypotheken, EWF/HRA summary, mortgage chart |
| `src/components/BankRekeningenSection.tsx` | Bankrekeningen tab — current balances |
| `src/components/IncomeSection.tsx` | Inkomen tab |
| `src/components/ExpensesSection.tsx` | Uitgaven tab |
| `src/components/SchuldenSection.tsx` | Schulden tab (DUO + beleggingsschulden) |
| `src/components/PortfolioSection.tsx` | Portfolio tab |
| `src/components/AfschrijvingenSection.tsx` | Afschrijvingen tab |
| `src/components/WaardesSection.tsx` | Waardes 1 jan tab (informational only) |
| `src/components/TaxResults.tsx` | Resultaten panel (right side) |
| `src/i18n/translations.ts` | NL + EN strings |

---

## Things Tried That Failed

### Mortgage chart disappearing (twice)
1. **First attempt**: added `useRef` + SVG `<text>` tooltip → chart became invisible. Root cause: SVG text positioning off-screen at zero values before data loaded.
2. **Second attempt**: switched to `useCallback` for mouse handler but callback closed over stale `iW` value → chart still invisible.
3. **Fix that worked**: dropped useRef/useCallback entirely. Mouse handler is a plain function using `e.currentTarget.getBoundingClientRect()` inline. HTML `<div>` overlay for tooltip (positioned with `style={{ left: ... }}`) instead of SVG text.

### Box 3 still using Waardes 1 jan after disconnect
- First fix only updated `calculateBox3` but `calculateTaxes` still destructured `waardes` and used `waardes.beleggingen` for `portfolioJan1Value`. Had to also remove `waardes` from `calculateTaxes` destructure and set `portfolioJan1Value = 0`.

### Cashflow total not matching line items
- Added DUO + afschrijvingen as line items in cashflow BUT `netDisposableIncome` was computed before those values were calculated, so the total didn't subtract them. Fix: moved DUO and afschrijvingen computation before `netDisposableIncome` and included them in the formula.

### BankRekeningenSection `compact` prop
- Used a non-existent `compact` prop on `CurrencyInput`. Removed.

---

## Next Steps (in priority order)

1. **Aflossingsvrij aftrekbaarheid**: Add a checkbox per hypotheek: "Valt onder overgangsrecht (vóór 2013)". When unchecked (post-2013 aflossingsvrij), exclude that hypotheek's rente from the aftrekpost. This is the most common real-world gotcha.

2. **Box 3 peildatum voor bankData**: Currently uses current balances for Box 3. Consider adding a toggle or note: "Gebruik huidige saldi als schatting voor 1 januari" — or add a separate Jan-1 balance field on BankRekeningenSection. The `WaardesData` already has Jan-1 spaarrekeningen but is disconnected.

3. **HRA in TaxResults Box 1 breakdown**: The Box 1 result card shows `taxableIncome` (already after EWF+HRA) but doesn't break down how it was computed. Consider adding a sub-row showing: bruto inkomen, − netto aftrekpost (rente − EWF), − pensioenaftrek = belastbaar inkomen.

4. **Wet Hillen display**: When EWF > rente (Hillen scenario), the WoonSection now shows a warning but the Resultaten panel doesn't show the eigenwoninginkomen addition explicitly. Add a line in the Box 1 breakdown.

5. **PrognoseConfig**: `NetWorthProjection.tsx` exists but hasn't been verified to work correctly with the updated data model (bankData for savings, portfolio for investments, no waardes).

6. **DUO phase awareness**: `berekenDuoJaarbetaling` is called regardless of which phase the loan is in (aangroei vs. aflossing). If the user is in the aangroei phase, the actual payment is €0. Consider using `SchuldItem.aflossingsStartJaar` to gate the calculation.
