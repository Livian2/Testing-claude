import { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Sparkles, Calculator, Home, Wallet,
  TrendingUp, Shield, BookOpen, CheckCircle2,
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

interface Step {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  body: React.ReactNode;
}

export default function WelcomeModal({ onClose }: Props) {
  const [step, setStep] = useState(0);

  const steps: Step[] = [
    {
      icon: <Sparkles size={28} />,
      title: 'Welkom bij NL Belastingcalculator',
      subtitle: 'Een live financiële tool voor belastingjaar 2026',
      body: (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Deze tool berekent je <strong>complete fiscale situatie in real-time</strong>: van inkomstenbelasting
            en hypotheekrenteaftrek tot Box 3 vermogen, toeslagen en een 20-jaars vermogensprognose.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FeatureCard
              icon={<Shield size={18} />}
              color="emerald"
              title="100% privé"
              desc="Alle data blijft in je browser. Niets wordt naar een server gestuurd."
            />
            <FeatureCard
              icon={<Calculator size={18} />}
              color="blue"
              title="Live berekening"
              desc="Wijzigingen worden direct verwerkt — geen 'Bereken' knop nodig."
            />
            <FeatureCard
              icon={<BookOpen size={18} />}
              color="purple"
              title="2026 regels"
              desc="Alle tarieven en grenzen voor het belastingjaar 2026 zijn ingebouwd."
            />
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
            <strong>Belangrijk:</strong> Dit is een indicatieve berekening voor inzicht en planning.
            Voor je definitieve aangifte: gebruik de officiële Belastingdienst-tool of een fiscaal adviseur.
          </div>
        </div>
      ),
    },
    {
      icon: <Home size={28} />,
      title: 'De tabbladen',
      subtitle: 'Vul alleen in wat van toepassing is — schakel tabs uit op de Start pagina',
      body: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            { emoji: '💼', name: 'Inkomen',         desc: 'Salaris, ZZP, huurinkomsten, lijfrente' },
            { emoji: '🏠', name: 'Wonen',           desc: 'Hypotheek (alle types), WOZ, VvE, GWE' },
            { emoji: '📋', name: 'Waardes 1 jan',   desc: 'Box 3 stand: beleggingen, spaargeld op peildatum' },
            { emoji: '🛒', name: 'Kosten',          desc: 'Maandelijkse uitgaven + spaar/beleg bijdrage' },
            { emoji: '💳', name: 'Schulden',        desc: 'DUO (SF15/SF35), beleggingsleningen' },
            { emoji: '🏦', name: 'Bankrekeningen',  desc: 'Huidige saldi (los van peildatum)' },
            { emoji: '📈', name: 'Beleggen',        desc: 'Portfolio met live Yahoo Finance koersen' },
            { emoji: '🔄', name: 'Afschrijvingen',  desc: 'Sinking funds: sparen voor toekomstige vervangingen' },
            { emoji: '🔮', name: 'Prognose',        desc: 'Vermogensgroei 10/20/30 jaar vooruit' },
            { emoji: '🧮', name: 'Berekening',      desc: 'Live totaaloverzicht van alle belastingen' },
          ].map(tab => (
            <div key={tab.name} className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700">
              <span className="text-lg leading-none mt-0.5">{tab.emoji}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tab.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{tab.desc}</div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: <Calculator size={28} />,
      title: 'Hoe wordt je belasting berekend?',
      subtitle: 'De drie boxen en de toeslagen — kort uitgelegd',
      body: (
        <div className="space-y-3">
          <CalcCard
            title="Box 1 — Werk en inkomen"
            color="blue"
            content={
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between"><span>Schijf 1 (tot €38.441)</span><strong className="font-mono">35,82%</strong></div>
                <div className="flex justify-between"><span>Schijf 2 (€38.441 – €78.426)</span><strong className="font-mono">37,48%</strong></div>
                <div className="flex justify-between"><span>Schijf 3 (boven €78.426)</span><strong className="font-mono">49,50%</strong></div>
                <p className="pt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Salaris + ZZP-winst − hypotheekrente − lijfrente = belastbaar inkomen.
                  Algemene heffingskorting en arbeidskorting worden automatisch toegepast.
                </p>
              </div>
            }
          />
          <CalcCard
            title="Box 3 — Vermogen"
            color="purple"
            content={
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <p>Belasting op <strong>fictief rendement</strong> over je vermogen op 1 januari:</p>
                <div className="flex justify-between"><span>Spaargeld</span><strong className="font-mono">1,03%</strong></div>
                <div className="flex justify-between"><span>Beleggingen</span><strong className="font-mono">5,88%</strong></div>
                <div className="flex justify-between"><span>Schulden (aftrek)</span><strong className="font-mono">2,62%</strong></div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700"><span>Belastingtarief</span><strong className="font-mono">36%</strong></div>
                <p className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Heffingvrij vermogen: €57.684 (alleenstaand) of €115.368 (fiscale partners).
                </p>
              </div>
            }
          />
          <CalcCard
            title="Toeslagen"
            color="emerald"
            content={
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <p><strong>Zorgtoeslag:</strong> normpremie − 5,75% × inkomen, max €1.548/jr (single).</p>
                <p><strong>Huurtoeslag:</strong> bij huurwoning onder de liberalisatiegrens (€900/mnd).</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Het toetsingsinkomen is je verzamelinkomen (Box 1 + Box 3 inkomensbestanddelen).
                </p>
              </div>
            }
          />
        </div>
      ),
    },
    {
      icon: <Wallet size={28} />,
      title: 'Hypotheekrenteaftrek (HRA)',
      subtitle: 'Hoe je hypotheek je belasting verlaagt',
      body: (
        <div className="space-y-3">
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Eigenwoningforfait (EWF)
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-8">
              Een fictief inkomen omdat je in je eigen huis woont. <strong>0,35%</strong> van de WOZ-waarde wordt opgeteld bij je Box 1 inkomen.
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Renteaftrek
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-8">
              De betaalde hypotheekrente <strong>min EWF</strong> wordt afgetrokken van je belastbaar inkomen. Aftrek tegen max <strong>37,48%</strong> tarief.
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              Aflossingsvrij & Wet Hillen
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-8">
              Aflossingsvrije hypotheken na 2013 zijn <strong>niet meer aftrekbaar</strong>. Wet Hillen verlaagt EWF als je geen of weinig rente meer betaalt.
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
            💡 De netto woonlasten en jaarlijkse belastingvoordeel zie je live in het <strong>Wonen</strong> tabblad.
          </div>
        </div>
      ),
    },
    {
      icon: <TrendingUp size={28} />,
      title: 'Klaar om te beginnen',
      subtitle: 'Een paar tips om snel op gang te komen',
      body: (
        <div className="space-y-3">
          <TipRow num={1} title="Start op de Start-pagina">
            Schakel daar de tabbladen aan/uit die voor jou relevant zijn. De data blijft bewaard, ook van uitgeschakelde tabs.
          </TipRow>
          <TipRow num={2} title="Begin met Inkomen + Wonen">
            Dit zijn de twee belangrijkste invoer­velden. De live berekening rechts past zich direct aan.
          </TipRow>
          <TipRow num={3} title="Portfolio: vul tickers in">
            Bijv. <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[11px]">VWCE.AS</code> of ISINs voor live koersen via Yahoo Finance.
          </TipRow>
          <TipRow num={4} title="Exporteer regelmatig">
            Met de <strong>Exporteer</strong> knop maak je een JSON backup. Importeer die later op een ander apparaat.
          </TipRow>
          <TipRow num={5} title="Donker thema">
            Klik op het maantje/zonnetje rechtsboven om te wisselen tussen licht en donker.
          </TipRow>
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3 text-center mt-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Veel succes! 🚀</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">Je kan deze uitleg altijd opnieuw openen via de <strong>?</strong> knop rechtsboven.</p>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast  = step === steps.length - 1;
  const isFirst = step === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-orange-500 to-amber-500 dark:from-orange-600 dark:to-amber-600 px-6 py-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors border-0 text-white cursor-pointer"
            aria-label="Sluiten"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 flex-shrink-0">
              {current.icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold leading-tight m-0">{current.title}</h2>
              <p className="text-xs sm:text-sm text-white/80 mt-0.5">{current.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {current.body}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all cursor-pointer border-0 ${
                  i === step ? 'w-6 bg-orange-500' : 'w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                }`}
                aria-label={`Stap ${i + 1}`}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors bg-transparent border-0 cursor-pointer"
              >
                <ChevronLeft size={14} /> Terug
              </button>
            )}
            {isLast ? (
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors border-0 cursor-pointer shadow-sm"
              >
                <CheckCircle2 size={14} /> Aan de slag
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors border-0 cursor-pointer shadow-sm"
              >
                Volgende <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, color, title, desc }: { icon: React.ReactNode; color: 'emerald' | 'blue' | 'purple'; title: string; desc: string }) {
  const colorMap = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    blue:    'bg-blue-50    dark:bg-blue-900/20    border-blue-200    dark:border-blue-800    text-blue-600    dark:text-blue-400',
    purple:  'bg-purple-50  dark:bg-purple-900/20  border-purple-200  dark:border-purple-800  text-purple-600  dark:text-purple-400',
  };
  return (
    <div className={`border rounded-xl p-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-1.5 mb-1.5">{icon}<span className="text-xs font-bold">{title}</span></div>
      <p className="text-[11px] leading-relaxed opacity-90 m-0">{desc}</p>
    </div>
  );
}

function CalcCard({ title, color, content }: { title: string; color: 'blue' | 'purple' | 'emerald'; content: React.ReactNode }) {
  const colorMap = {
    blue:    'border-blue-300    dark:border-blue-700    bg-blue-50/50    dark:bg-blue-900/10',
    purple:  'border-purple-300  dark:border-purple-700  bg-purple-50/50  dark:bg-purple-900/10',
    emerald: 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10',
  };
  const titleColor = {
    blue:    'text-blue-700    dark:text-blue-300',
    purple:  'text-purple-700  dark:text-purple-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
  };
  return (
    <div className={`border rounded-xl p-3.5 ${colorMap[color]}`}>
      <h4 className={`text-sm font-bold mb-2 ${titleColor[color]}`}>{title}</h4>
      {content}
    </div>
  );
}

function TipRow({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-gradient-to-br from-orange-400 to-amber-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
        {num}
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed m-0">{children}</p>
      </div>
    </div>
  );
}
