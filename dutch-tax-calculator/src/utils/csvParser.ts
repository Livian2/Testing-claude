export type BrokerFormat = 'degiro';

export interface ImportedTransaction {
  date: string;       // YYYY-MM-DD
  holdingName: string;
  isin: string;
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
  if (firstLine.includes('Datum') && firstLine.includes('Uitvoeringsplaats') && firstLine.includes('ISIN')) {
    return 'degiro';
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
      const product    = row[2]?.trim() ?? '';
      const isin       = row[3]?.trim() ?? '';
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

// ─── Dispatcher ─────────────────────────────────────────────────────────────
export function parseBrokerCSV(
  content: string,
  broker: BrokerFormat,
  brokerName: string,
): ParseResult {
  if (broker === 'degiro') return parseDeGiro(content, brokerName);
  return { transactions: [], skipped: 0, errors: [`Broker format '${broker}' niet ondersteund.`] };
}
