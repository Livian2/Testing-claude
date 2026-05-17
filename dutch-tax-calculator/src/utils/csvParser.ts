export type BrokerFormat = 'degiro' | 'ibkr' | 'bux';

export interface ImportedTransaction {
  date: string;       // YYYY-MM-DD
  holdingName: string;
  isin: string;
  ticker: string;     // direct ticker symbol (provided by some brokers, e.g. IBKR)
  type: 'buy' | 'sell';
  quantity: number;
  priceEur: number;   // price per unit in EUR
  currency: string;   // original trade currency
  broker: string;
  orderId: string;    // for deduplication
  warnings: string[];
}

export interface ParseResult {
  transactions: ImportedTransaction[];
  skipped: number;
  errors: string[];
  detectedBroker?: BrokerFormat;
}

// ─── Dutch number parser ────────────────────────────────────────────────────
// Handles: "23,0950" → 23.095  |  "-1.485,00" → -1485  |  "21" → 21
function parseNl(s: string): number {
  s = s.replace(/^"|"$/g, '').trim();
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

// DD-MM-YYYY or DD/MM/YYYY → YYYY-MM-DD
function parseDutchDate(s: string): string {
  const m = s.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s.trim();
}

// ─── Generic CSV parser ──────────────────────────────────────────────────────
// Handles RFC 4180 quoting, Windows/Unix line endings, BOM
export function parseCSV(content: string): string[][] {
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const nx = content[i + 1];

    if (inQ) {
      if (c === '"' && nx === '"') { field += '"'; i++; }
      else if (c === '"')          { inQ = false; }
      else                         { field += c; }
    } else {
      if      (c === '"')                      { inQ = true; }
      else if (c === ',')                      { row.push(field); field = ''; }
      else if (c === ';')                      { row.push(field); field = ''; } // some locales
      else if (c === '\n' || (c === '\r' && nx === '\n')) {
        if (c === '\r') i++;
        row.push(field); field = '';
        rows.push(row);  row = [];
      } else if (c === '\r') {
        row.push(field); field = '';
        rows.push(row);  row = [];
      } else { field += c; }
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

// ─── Broker auto-detection ───────────────────────────────────────────────────
export function detectBroker(content: string): BrokerFormat | null {
  const firstLine = content.split('\n')[0] ?? '';
  if (firstLine.startsWith('Transaction History,') && firstLine.includes('Transaction Type')) {
    return 'ibkr';
  }
  if (firstLine.includes('Datum') && firstLine.includes('Uitvoeringsplaats') && firstLine.includes('ISIN')) {
    return 'degiro';
  }
  if (firstLine.includes('Transaction Time (CET)') && firstLine.includes('Transfer Type')) {
    return 'bux';
  }
  return null;
}

// ─── DEGIRO parser ───────────────────────────────────────────────────────────
// Column layout (0-based):
//  0 Datum  1 Tijd  2 Product  3 ISIN  4 Beurs  5 Uitvoeringsplaats
//  6 Aantal  7 Koers  8 (koers currency)  9 Lokale waarde  10 (local currency)
//  11 Waarde EUR  12 Wisselkoers  13 AutoFX  14 Transactiekosten  15 Totaal EUR
//  16 Order ID  17 UUID
export function parseDeGiro(content: string, brokerName: string): ParseResult {
  const rows = parseCSV(content);
  if (rows.length < 2) return { transactions: [], skipped: 0, errors: ['Geen data gevonden in CSV.'] };

  const transactions: ImportedTransaction[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    try {
      const dateStr    = row[0]?.trim() ?? '';
      const rawProduct = row[2]?.trim() ?? '';

      // Extract ISIN: prefer dedicated column (3), fall back to embedded ISIN in product name
      const isinInCol  = row[3]?.trim() ?? '';
      const isinInName = /\b([A-Z]{2}[A-Z0-9]{10})\b/.exec(rawProduct)?.[1] ?? '';
      const isin       = isinInCol || isinInName;
      // Clean product name: strip embedded ISIN + surrounding whitespace/parens
      const product    = isinInName && !isinInCol
        ? rawProduct.replace(new RegExp(`\\(?${isinInName}\\)?`), '').replace(/\s+/g, ' ').trim()
        : rawProduct;

      const aantalStr  = row[6]?.trim() ?? '';
      const koersStr   = row[7]?.trim() ?? '';
      const currency   = row[8]?.trim() || 'EUR';
      const waardeEur  = row[11]?.trim() ?? '';
      // UUID is at index 17 (if present), else fall back to index 16
      const uuid       = (row[17]?.trim() || row[16]?.trim()) ?? '';

      // Skip rows without essential trade data (cash movements, dividends, etc.)
      if (!product || !aantalStr || !koersStr) { skipped++; continue; }

      const aantal = parseNl(aantalStr);
      const koers  = parseNl(koersStr);

      if (isNaN(aantal) || aantal === 0 || isNaN(koers) || koers === 0) {
        skipped++;
        continue;
      }

      const type: 'buy' | 'sell' = aantal > 0 ? 'buy' : 'sell';
      const quantity = Math.abs(aantal);

      // EUR price per unit from Waarde EUR (excludes transaction costs)
      const waardeNum = parseNl(waardeEur);
      const priceEur  = (!isNaN(waardeNum) && waardeNum !== 0 && quantity > 0)
        ? Math.abs(waardeNum) / quantity
        : koers;

      const orderId = uuid || `${dateStr}|${product}|${aantalStr}|${koersStr}`;

      transactions.push({
        date: parseDutchDate(dateStr),
        holdingName: product,
        isin,
        ticker: '',
        type,
        quantity,
        priceEur,
        currency,
        broker: brokerName,
        orderId,
        warnings: currency !== 'EUR' ? [`Prijs omgerekend naar EUR (origineel: ${koers} ${currency})`] : [],
      });
    } catch {
      errors.push(`Rij ${i + 1} kon niet worden verwerkt.`);
      skipped++;
    }
  }

  return { transactions, skipped, errors, detectedBroker: 'degiro' };
}

// ─── IBKR parser ─────────────────────────────────────────────────────────────
// Every row starts with "Transaction History".
// Column 1 is "Header" (column names row) or "Data" (actual data).
// Column layout (0-based):
//  0 "Transaction History"  1 Header/Data  2 Date (YYYY-MM-DD)  3 Account
//  4 Description  5 Transaction Type  6 Symbol  7 Quantity  8 Price
//  9 Price Currency  10 Gross Amount (EUR base)  11 Commission  12 Net Amount
//
// Only rows with Transaction Type "Buy" or "Sell" are trades.
// Forex Trade Component and Adjustment rows are skipped.
// Gross Amount is in the account base currency (EUR) so priceEur = |gross| / qty.
export function parseIBKR(content: string, brokerName: string): ParseResult {
  const rows = parseCSV(content);
  if (rows.length < 2) return { transactions: [], skipped: 0, errors: ['Geen data gevonden in CSV.'] };

  const transactions: ImportedTransaction[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    // Only process data rows (skip header row and any section headers)
    if (row[1]?.trim() !== 'Data') { skipped++; continue; }

    const txType = row[5]?.trim() ?? '';
    if (txType !== 'Buy' && txType !== 'Sell') { skipped++; continue; }

    try {
      const dateStr     = row[2]?.trim() ?? '';
      const description = row[4]?.trim() ?? '';
      const symbol      = row[6]?.trim() ?? '';
      const quantityStr = row[7]?.trim() ?? '';
      const priceStr    = row[8]?.trim() ?? '';
      const currency    = row[9]?.trim() || 'USD';
      const grossStr    = row[10]?.trim() ?? '';

      const quantity = parseFloat(quantityStr);
      const price    = parseFloat(priceStr);
      const gross    = parseFloat(grossStr);

      if (!description || !symbol || isNaN(quantity) || quantity === 0 || isNaN(price)) {
        skipped++;
        continue;
      }

      const type: 'buy' | 'sell' = txType === 'Buy' ? 'buy' : 'sell';
      const qty = Math.abs(quantity);

      // Gross Amount is in account base currency (EUR).
      // priceEur = |gross| / qty gives cost per share in EUR.
      const priceEur = (!isNaN(gross) && gross !== 0 && qty > 0)
        ? Math.abs(gross) / qty
        : price; // fallback: raw price (might be in foreign currency)

      const orderId = `${dateStr}|${symbol}|${quantityStr}|${priceStr}`;

      transactions.push({
        date: dateStr,    // already YYYY-MM-DD
        holdingName: description,
        isin: '',
        ticker: symbol,   // IBKR provides ticker directly
        type,
        quantity: qty,
        priceEur,
        currency,
        broker: brokerName,
        orderId,
        warnings: currency !== 'EUR' ? [`Prijs omgezet via Gross Amount (origineel: ${price} ${currency})`] : [],
      });
    } catch {
      errors.push(`Rij kon niet worden verwerkt.`);
      skipped++;
    }
  }

  return { transactions, skipped, errors, detectedBroker: 'ibkr' };
}

// ─── BUX parser ──────────────────────────────────────────────────────────────
// BUX exports a CSV where each trade produces TWO rows with the same Order Partial Id:
//   ASSET_TRADE_BUY  — the asset side  (positive amount = shares received)
//   CASH_DEBIT       — the cash side   (negative amount = EUR paid)
//
// We process only the CASH_DEBIT rows (category=trades) to get one transaction per
// order with the actual EUR cost. Fees (category=fees) are skipped.
//
// Column layout from header row:
//   Transaction Time (CET), Transaction Category, Transaction Type, Transfer Type,
//   Transaction Amount, Transaction Currency, Cash Balance Amount, Asset Id, Asset Name,
//   Asset Quantity, Asset Price, Asset Currency, Currency Pair, Exchange Rate, ...
//   Transaction Description
export function parseBux(content: string, brokerName: string): ParseResult {
  const rows = parseCSV(content);
  if (rows.length < 2) return { transactions: [], skipped: 0, errors: ['Geen data gevonden in CSV.'] };

  const headers = rows[0].map(h => h.trim());
  const col = (name: string) => headers.indexOf(name);

  const COL_TIME     = col('Transaction Time (CET)');
  const COL_CATEGORY = col('Transaction Category');
  const COL_TX_TYPE  = col('Transaction Type');
  const COL_TRANSFER = col('Transfer Type');
  const COL_AMOUNT   = col('Transaction Amount');
  const COL_CURRENCY = col('Transaction Currency');
  const COL_ISIN     = col('Asset Id');
  const COL_NAME     = col('Asset Name');
  const COL_QTY      = col('Asset Quantity');
  const COL_RATE     = col('Exchange Rate');
  const COL_DESC     = col('Transaction Description');

  if (COL_TIME < 0 || COL_AMOUNT < 0 || COL_ISIN < 0) {
    return { transactions: [], skipped: 0, errors: ['Kolommen niet herkend. Controleer het BUX CSV-formaat.'] };
  }

  const transactions: ImportedTransaction[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 5) { skipped++; continue; }

    const category = row[COL_CATEGORY]?.trim() ?? '';
    const transfer = row[COL_TRANSFER]?.trim() ?? '';

    // Only process the cash side of a trade; the asset side and all fees are skipped
    if (category !== 'trades' || transfer !== 'CASH_DEBIT') { skipped++; continue; }

    try {
      const timeStr  = row[COL_TIME]?.trim() ?? '';
      const dateStr  = timeStr.split(' ')[0] ?? '';          // YYYY-MM-DD from "YYYY-MM-DD HH:mm:ss..."
      const txType   = row[COL_TX_TYPE]?.trim() ?? '';
      const isin     = row[COL_ISIN]?.trim() ?? '';
      const name     = row[COL_NAME]?.trim() ?? '';
      const qtyStr   = row[COL_QTY]?.trim() ?? '';
      const amtStr   = row[COL_AMOUNT]?.trim() ?? '';
      const currency = row[COL_CURRENCY]?.trim() || 'EUR';
      const rateStr  = row[COL_RATE]?.trim() ?? '';
      const descStr  = row[COL_DESC]?.trim() ?? '';

      if (!name || !isin || !qtyStr || !amtStr) { skipped++; continue; }

      const qty = parseFloat(qtyStr);
      const amt = parseFloat(amtStr);   // negative for buys, positive for sells

      if (isNaN(qty) || qty === 0 || isNaN(amt)) { skipped++; continue; }

      const type: 'buy' | 'sell' = txType.toLowerCase().includes('sell') ? 'sell' : 'buy';
      const quantity = Math.abs(qty);
      const totalEur = Math.abs(amt);
      const priceEur = quantity > 0 ? totalEur / quantity : 0;

      // Extract UUID from "Order Partial Id: UUID - 1" or "Order Id: UUID"
      const orderMatch = /Order (?:Partial )?Id: ([0-9a-f-]{36})/i.exec(descStr);
      const orderId = orderMatch ? orderMatch[1] : `${dateStr}|${isin}|${qtyStr}|${amtStr}`;

      const warnings: string[] = [];
      if (currency !== 'EUR') {
        const rate = parseFloat(rateStr);
        warnings.push(`FX ${currency}/EUR${!isNaN(rate) ? ` @ ${rate}` : ''} — EUR bedrag al verwerkt.`);
      }

      transactions.push({
        date: dateStr,
        holdingName: name,
        isin,
        ticker: '',
        type,
        quantity,
        priceEur,
        currency,
        broker: brokerName,
        orderId,
        warnings,
      });
    } catch {
      errors.push(`Rij ${i + 1} kon niet worden verwerkt.`);
      skipped++;
    }
  }

  return { transactions, skipped, errors, detectedBroker: 'bux' };
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────
export function parseBrokerCSV(
  content: string,
  broker: BrokerFormat,
  brokerName: string,
): ParseResult {
  if (broker === 'degiro') return parseDeGiro(content, brokerName);
  if (broker === 'ibkr')   return parseIBKR(content, brokerName);
  if (broker === 'bux')    return parseBux(content, brokerName);
  return { transactions: [], skipped: 0, errors: [`Broker format '${broker}' niet ondersteund.`] };
}
