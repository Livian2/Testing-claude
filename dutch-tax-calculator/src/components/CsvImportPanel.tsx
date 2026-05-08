import { useState, useCallback } from 'react';
import { Upload, CheckCircle2, AlertCircle, ArrowUpCircle, ArrowDownCircle, Info } from 'lucide-react';
import type { Transaction, Holding } from '../types';
import {
  type BrokerFormat, type ImportedTransaction, type ParseResult,
  detectBroker, parseBrokerCSV,
} from '../utils/csvParser';

interface Props {
  existingTransactions: Transaction[];
  existingHoldings: Holding[];
  onImport: (newTxs: Transaction[], newHoldings: Holding[]) => void;
}

function uid() { return Math.random().toString(36).slice(2); }

const nl0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nl2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface BrokerDef {
  id: BrokerFormat;
  name: string;
  description: string;
  available: boolean;
  color: string;
}

const BROKERS: BrokerDef[] = [
  { id: 'degiro', name: 'DEGIRO',                    description: 'Transacties CSV via "Exporteer"',          available: true, color: 'border-green-500 bg-green-50 text-green-800' },
  { id: 'ibkr',   name: 'Interactive Brokers (IBKR)', description: 'Transaction History CSV via Flex Query',  available: true, color: 'border-blue-500 bg-blue-50 text-blue-800' },
];

const COMING_SOON = [
  { name: 'Saxo Bank',  description: 'Transaction report CSV' },
  { name: 'eToro',      description: 'Account statement' },
];

type Step = 'broker' | 'file' | 'preview' | 'done';

export default function CsvImportPanel({ existingTransactions, existingHoldings, onImport }: Props) {
  const [step, setStep]               = useState<Step>('broker');
  const [broker, setBroker]           = useState<BrokerFormat | null>(null);
  const [brokerName, setBrokerName]   = useState('');
  const [fileName, setFileName]       = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [dragOver, setDragOver]       = useState(false);
  const [importDone, setImportDone]   = useState(0);

  // Build a set of existing orderId's for dedup
  const existingOrderIds = new Set(
    existingTransactions.map(t => t.orderId).filter(Boolean)
  );

  const isDuplicate = (tx: ImportedTransaction) =>
    tx.orderId ? existingOrderIds.has(tx.orderId) : false;

  const newTxs    = parseResult?.transactions.filter(t => !isDuplicate(t)) ?? [];
  const dupeCount = (parseResult?.transactions.length ?? 0) - newTxs.length;

  const handleFile = useCallback((file: File) => {
    if (!broker) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string) ?? '';
      const autoDetected = detectBroker(text);
      const effectiveBroker = autoDetected ?? broker;
      const fallbackName = BROKERS.find(b => b.id === broker)?.name ?? broker;
      const result = parseBrokerCSV(text, effectiveBroker, brokerName || fallbackName);
      setParseResult(result);
      setStep('preview');
    };
    reader.readAsText(file, 'utf-8');
  }, [broker, brokerName]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleImport = () => {
    // Build lookup maps from existing holdings to match by ISIN or ticker
    const isinToName = new Map(
      existingHoldings.filter(h => h.isin).map(h => [h.isin!.toUpperCase(), h.name])
    );
    const tickerToName = new Map(
      existingHoldings.filter(h => h.ticker).map(h => [h.ticker.toUpperCase(), h.name])
    );

    // Resolve holdingName: reuse existing holding name when ISIN or ticker matches
    const resolveHoldingName = (t: ImportedTransaction): string => {
      if (t.isin) {
        const existing = isinToName.get(t.isin.toUpperCase());
        if (existing) return existing;
      }
      if (t.ticker) {
        const existing = tickerToName.get(t.ticker.toUpperCase());
        if (existing) return existing;
        // Match bare ticker against exchange-specific tickers (e.g. "TDIV" matches "TDIV.AS")
        const bare = t.ticker.toUpperCase().split('.')[0];
        for (const [k, v] of tickerToName) {
          if (k.split('.')[0] === bare) return v;
        }
      }
      return t.holdingName;
    };

    const toImport: Transaction[] = newTxs.map(t => ({
      id:           uid(),
      holdingName:  resolveHoldingName(t),
      type:         t.type,
      date:         t.date,
      quantity:     t.quantity,
      pricePerUnit: t.priceEur,
      broker:       t.broker,
      orderId:      t.orderId,
    }));

    // Auto-create Holdings for positions not yet in existingHoldings
    // Skip if ISIN or ticker already belongs to an existing holding
    const existingNames   = new Set(existingHoldings.map(h => h.name.toLowerCase()));
    const existingIsins   = new Set(existingHoldings.filter(h => h.isin).map(h => h.isin!.toUpperCase()));
    const existingTickers = new Set(existingHoldings.filter(h => h.ticker).map(h => h.ticker.toUpperCase()));

    const seen = new Set<string>();
    const newHoldings: Holding[] = [];
    for (const t of newTxs) {
      const resolvedName = resolveHoldingName(t);
      const key = resolvedName.toLowerCase();
      if (existingNames.has(key) || seen.has(key)) continue;
      if (t.isin && existingIsins.has(t.isin.toUpperCase())) continue;
      if (t.ticker) {
        const tickerUpper = t.ticker.toUpperCase();
        if (existingTickers.has(tickerUpper)) continue;
        const bare = tickerUpper.split('.')[0];
        let matchesBare = false;
        for (const k of existingTickers) {
          if (k.split('.')[0] === bare) { matchesBare = true; break; }
        }
        if (matchesBare) continue;
      }
      seen.add(key);
      newHoldings.push({
        id:           uid(),
        name:         resolvedName,
        type:         'stocks',
        quantity:     0,
        pricePerUnit: 0,
        broker:       t.broker,
        ticker:       t.ticker || '',
        isin:         t.isin   || '',
        currentPrice: 0,
      });
    }

    onImport(toImport, newHoldings);
    setImportDone(toImport.length);
    setStep('done');
  };

  const reset = () => {
    setStep('broker');
    setBroker(null);
    setBrokerName('');
    setFileName('');
    setParseResult(null);
    setImportDone(0);
  };

  // ── Step: broker selection ──────────────────────────────────────────────
  if (step === 'broker') {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Selecteer uw broker</p>
          <p className="text-xs text-slate-500">Elke broker heeft een eigen CSV-formaat. Selecteer uw broker voor de juiste verwerking.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BROKERS.map(b => (
            <button
              key={b.id}
              onClick={() => { setBroker(b.id); setBrokerName(b.name); setStep('file'); }}
              className={`flex flex-col gap-1 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${b.color}`}
            >
              <span className="text-sm font-bold">{b.name}</span>
              <span className="text-xs opacity-75">{b.description}</span>
            </button>
          ))}

          {COMING_SOON.map(b => (
            <div
              key={b.name}
              className="flex flex-col gap-1 p-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-400 opacity-60"
            >
              <span className="text-sm font-medium">{b.name}</span>
              <span className="text-xs">{b.description} — binnenkort</span>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span className="space-y-1 block">
            <span className="block"><strong>DEGIRO:</strong> ga naar <em>Account → Transacties</em> en klik op <em>Exporteer</em> (CSV). Selecteer de gewenste periode en download het bestand.</span>
            <span className="block"><strong>IBKR:</strong> ga naar <em>Reports → Flex Queries</em> en maak een <em>Transaction History</em> rapport aan, of gebruik <em>Activity → Statements → Transaction History</em> en exporteer als CSV.</span>
          </span>
        </div>
      </div>
    );
  }

  // ── Step: file upload ───────────────────────────────────────────────────
  if (step === 'file') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('broker')}
            className="text-xs text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer px-0">
            ← Terug
          </button>
          <span className="text-sm font-semibold text-slate-700">
            {BROKERS.find(b => b.id === broker)?.name ?? broker} — CSV importeren
          </span>
        </div>

        {/* Optional: custom broker name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Brokernaam (optioneel)</label>
          <input
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 max-w-xs"
            placeholder={BROKERS.find(b => b.id === broker)?.name ?? ''}
            value={brokerName}
            onChange={e => setBrokerName(e.target.value)}
          />
          <p className="text-xs text-slate-400">Wordt als brokernaam opgeslagen bij elke transactie.</p>
        </div>

        {/* Drop zone */}
        <label
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            dragOver
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white'
          }`}
        >
          <Upload size={28} className={dragOver ? 'text-indigo-500' : 'text-slate-400'} />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">Sleep CSV-bestand hierheen</p>
            <p className="text-xs text-slate-400">of klik om een bestand te kiezen</p>
          </div>
          <input type="file" accept=".csv,.txt" className="hidden" onChange={handleInputChange} />
        </label>
      </div>
    );
  }

  // ── Step: preview ───────────────────────────────────────────────────────
  if (step === 'preview' && parseResult) {
    const { transactions, skipped, errors } = parseResult;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('file')}
            className="text-xs text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer px-0">
            ← Terug
          </button>
          <span className="text-sm font-semibold text-slate-700">
            Voorbeeld — {fileName}
          </span>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-slate-500">Gevonden</p>
            <p className="text-lg font-bold text-green-700">{transactions.length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-slate-500">Nieuw</p>
            <p className="text-lg font-bold text-blue-700">{newTxs.length}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-slate-500">Duplicaten</p>
            <p className="text-lg font-bold text-amber-700">{dupeCount}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-slate-500">Overgeslagen</p>
            <p className="text-lg font-bold text-slate-600">{skipped}</p>
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><AlertCircle size={13} />Verwerkingswaarschuwingen</p>
            {errors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
            Geen transacties gevonden in dit bestand.
            Controleer of u het juiste broker-formaat heeft geselecteerd.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Type</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Datum</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Naam</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">Aantal</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">Koers</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-500">Totaal</th>
                  <th className="text-center px-3 py-2 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => {
                  const dupe = isDuplicate(tx);
                  return (
                    <tr key={i} className={`border-b border-slate-100 last:border-0 ${dupe ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          tx.type === 'buy'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.type === 'buy'
                            ? <ArrowUpCircle size={10} />
                            : <ArrowDownCircle size={10} />}
                          {tx.type === 'buy' ? 'Koop' : 'Verkoop'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{tx.date}</td>
                      <td className="px-3 py-2 text-slate-800 max-w-[160px] truncate" title={tx.holdingName}>
                        {tx.holdingName}
                        {tx.isin && <div className="text-slate-400 font-mono text-xs">{tx.isin}</div>}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {tx.quantity.toLocaleString('nl-NL', { maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {nl2.format(tx.priceEur)}
                        {tx.currency !== 'EUR' && (
                          <span className="text-slate-400 ml-1">({tx.currency})</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">
                        {nl0.format(tx.quantity * tx.priceEur)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {dupe ? (
                          <span className="text-slate-400 text-xs">duplicaat</span>
                        ) : (
                          <CheckCircle2 size={13} className="text-green-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {newTxs.length > 0 && (
          <button
            onClick={handleImport}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 cursor-pointer border-0 transition-colors"
          >
            <CheckCircle2 size={16} />
            {newTxs.length} transacties importeren
            {dupeCount > 0 && ` (${dupeCount} duplicaten overgeslagen)`}
          </button>
        )}
      </div>
    );
  }

  // ── Step: done ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle2 size={28} className="text-green-600" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-slate-800">{importDone} transacties geïmporteerd</p>
        <p className="text-sm text-slate-500 mt-1">
          De transacties zijn toegevoegd aan uw portefeuille.
          Bekijk ze op het tabblad <strong>Transacties</strong> of <strong>Overzicht</strong>.
        </p>
      </div>
      <button onClick={reset}
        className="text-sm text-indigo-600 hover:text-indigo-800 bg-transparent border-0 cursor-pointer">
        Nog een CSV importeren
      </button>
    </div>
  );
}
