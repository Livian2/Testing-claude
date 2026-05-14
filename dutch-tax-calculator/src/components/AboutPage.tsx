import {
  ArrowRight, BarChart3, Calculator, Coins, Database, FileText, Gift,
  Home, LineChart, Lock, PieChart, Shield, Sparkles, TrendingUp, Wallet, X, Zap,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onGetStarted: () => void;
}

export default function AboutPage({ onClose, onGetStarted }: Props) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#08080b] text-slate-200 font-sans antialiased"
         style={{ fontFamily: '"Inter", "DM Sans", system-ui, -apple-system, sans-serif' }}>

      {/* ── Decorative orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-violet-600/25 via-fuchsia-500/10 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/15 via-amber-400/8 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-sky-500/12 via-blue-500/6 to-transparent blur-3xl" />
      </div>

      {/* ── Grid noise overlay ── */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.025]" aria-hidden style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── Top nav ── */}
      <header className="relative z-10 sticky top-0 backdrop-blur-xl bg-[#08080b]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">NL Belasting <span className="text-slate-500 font-normal">Pro</span></span>
            <span className="ml-1 text-[10px] font-mono text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">2026</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onGetStarted}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-white bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
            >
              Open de app <ArrowRight size={12} />
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors bg-transparent border-0 cursor-pointer"
              aria-label="Sluiten"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">

        {/* ── Hero ── */}
        <section className="pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-white/[0.03] border border-white/[0.06] rounded-full px-2.5 py-1 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live berekeningen — belastingjaar 2026
            </div>
            <h1 className="text-5xl lg:text-7xl font-semibold tracking-[-0.03em] text-white leading-[1.02]">
              Je volledige <br />
              <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">financiële plaatje</span>
              <br /> in één scherm.
            </h1>
            <p className="mt-7 text-base lg:text-lg text-slate-400 leading-relaxed max-w-2xl">
              Box 1 &amp; Box 3, toeslagen, hypotheek, DUO, portfolio en 30-jaar prognose —
              berekend volgens de officiële regels van de Nederlandse belastingdienst.
              Alles lokaal, niets naar een server.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button
                onClick={onGetStarted}
                className="group flex items-center gap-2 bg-white text-black hover:bg-slate-200 transition-colors font-medium text-sm rounded-lg px-5 py-2.5 cursor-pointer border-0"
              >
                Aan de slag
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <a href="#features"
                 className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2.5">
                Bekijk wat het kan ↓
              </a>
            </div>

            {/* Stat strip */}
            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
              {[
                { v: '9',   l: 'invoer-tabs'         },
                { v: '30j', l: 'prognose horizon'    },
                { v: '0',   l: 'data naar de cloud'  },
                { v: '∞',   l: 'scenario-vergelijkingen' },
              ].map(s => (
                <div key={s.l} className="bg-[#0a0a0d] px-5 py-5">
                  <div className="text-2xl font-semibold tabular-nums text-white tracking-tight">{s.v}</div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-20 border-t border-white/[0.06]">
          <div className="max-w-2xl mb-14">
            <div className="text-[11px] uppercase tracking-wider text-orange-400 font-medium mb-3">Modules</div>
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-white">
              Negen tabs. Eén consistent model.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Elke tab voedt dezelfde berekeningsmotor — geen losse spreadsheets,
              geen dubbele invoer, geen verrassingen.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
            {([
              { icon: Wallet,    name: 'Inkomen',       sub: 'Bruto loon, freelance, pensioenpremies, lijfrenteaftrek' },
              { icon: Home,      name: 'Wonen',         sub: 'Huur of koop, WOZ-waarde, eigenwoningforfait, Wet Hillen' },
              { icon: Database,  name: 'Waardes 1 jan', sub: 'Spaar- en beleggingssaldi op de Box 3 peildatum' },
              { icon: FileText,  name: 'Kosten',        sub: 'Vaste lasten, sparen, beleggen — netto besteedbaar' },
              { icon: Coins,     name: 'Schulden',      sub: 'DUO-leningen, beleggingsleningen — incl. afbouwsimulatie' },
              { icon: PieChart,  name: 'Portfolio',     sub: 'Transacties, FIFO-koerswinst, live prijzen via API' },
              { icon: BarChart3, name: 'Bank',          sub: 'Huidige spaarsaldi en rente, gescheiden van peildatum' },
              { icon: Shield,    name: 'Afschrijvingen',sub: 'Reservering voor toekomstige vervanging (auto, etc.)' },
              { icon: TrendingUp,name: 'Prognose',      sub: '30-jaar netto vermogen incl. WOZ en afschrijvingsreserve' },
            ] as const).map(({ icon: Icon, name, sub }) => (
              <div key={name}
                   className="bg-[#0a0a0d] hover:bg-[#0c0c10] transition-colors p-6 group">
                <div className="flex items-start gap-3.5">
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-300 group-hover:text-orange-400 group-hover:border-orange-500/30 transition-colors">
                    <Icon size={16} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">{name}</div>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Calculations breakdown ── */}
        <section className="py-20 border-t border-white/[0.06]">
          <div className="max-w-2xl mb-14">
            <div className="text-[11px] uppercase tracking-wider text-violet-400 font-medium mb-3">Berekeningen</div>
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-white">
              Hoe de cijfers tot stand komen.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Onder de motorkap. Alle formules volgen de officiële belastingregels voor 2026.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Box 1 */}
            <article className="relative bg-gradient-to-br from-[#0c0c11] to-[#0a0a0d] border border-white/[0.06] rounded-2xl p-7 overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-5">
                  <Calculator size={16} className="text-blue-400" />
                  <h3 className="text-base font-semibold text-white">Box 1 — inkomen uit arbeid</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Bruto loon + freelance − pensioenpremies − lijfrenteaftrek</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Eigenwoningforfait (EWF) bovenop, − hypotheekrente (HRA)</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Wet Hillen kapt aftrek af bij volledig afgelost</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Drie schijven (35,82% / 37,48% / 49,5%)</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Algemene heffingskorting + arbeidskorting</li>
                </ul>
                <div className="mt-5 font-mono text-[11px] text-blue-300/80 bg-blue-500/[0.05] border border-blue-500/10 rounded-lg px-3 py-2">
                  netto = (inkomen × schijftarief) − heffingskortingen
                </div>
              </div>
            </article>

            {/* Box 3 */}
            <article className="relative bg-gradient-to-br from-[#0c0c11] to-[#0a0a0d] border border-white/[0.06] rounded-2xl p-7 overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-violet-500/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-5">
                  <LineChart size={16} className="text-violet-400" />
                  <h3 className="text-base font-semibold text-white">Box 3 — vermogen</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Overgangsstelsel 2026 — fictief rendement per categorie</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Spaargeld 1,03% — beleggingen 5,88% — schulden 2,62%</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Heffingvrij vermogen €57.684 (€115.368 partners)</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Tarief 36% over fictieve grondslag</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Werkelijke rente naast informatief getoond</li>
                </ul>
                <div className="mt-5 font-mono text-[11px] text-violet-300/80 bg-violet-500/[0.05] border border-violet-500/10 rounded-lg px-3 py-2">
                  belasting = (Σ tarief × bezit) × 36%
                </div>
              </div>
            </article>

            {/* Toeslagen */}
            <article className="relative bg-gradient-to-br from-[#0c0c11] to-[#0a0a0d] border border-white/[0.06] rounded-2xl p-7 overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-teal-500/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-5">
                  <Gift size={16} className="text-teal-400" />
                  <h3 className="text-base font-semibold text-white">Toeslagen</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Zorgtoeslag — normpremie minus drempelpercentage × inkomen</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Huurtoeslag — bij maandhuur onder de grens en inkomen-eligible</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> HRA — belastingvoordeel hypotheekrente in Box 1</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Maandbedragen direct zichtbaar naast jaartotaal</li>
                </ul>
                <div className="mt-5 font-mono text-[11px] text-teal-300/80 bg-teal-500/[0.05] border border-teal-500/10 rounded-lg px-3 py-2">
                  zorgtoeslag = max(0, min(max, norm − 0,0575 × inkomen))
                </div>
              </div>
            </article>

            {/* Prognose */}
            <article className="relative bg-gradient-to-br from-[#0c0c11] to-[#0a0a0d] border border-white/[0.06] rounded-2xl p-7 overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-orange-500/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-5">
                  <TrendingUp size={16} className="text-orange-400" />
                  <h3 className="text-base font-semibold text-white">Prognose — netto vermogen</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Spaarsaldo groeit met spaarrente + maandelijkse inleg</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Beleggingen groeien met aangenomen rendement</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Hypotheek volgt jouw aflossingsschema (annuïteit/lineair)</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> DUO-saldo per jaar berekend o.b.v. inkomen + draagkracht</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> <span className="text-white">WOZ-waarde meegerekend</span> als constante actief</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> <span className="text-white">Afschrijvingsreserve</span> trekt geoormerkt geld af</li>
                </ul>
                <div className="mt-5 font-mono text-[11px] text-orange-300/80 bg-orange-500/[0.05] border border-orange-500/10 rounded-lg px-3 py-2">
                  netto = spaar + beleg + WOZ − schulden − reserve
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* ── Privacy / Trust ── */}
        <section className="py-20 border-t border-white/[0.06]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Lock,       title: 'Privacy by design',     body: 'Alle data blijft in jouw browser via localStorage. Geen account, geen server, geen tracking.' },
              { icon: Zap,        title: 'Realtime alles',        body: 'Elke wijziging herberekent direct. Geen "submit", geen wachten — gewoon scrollen en zien.' },
              { icon: Sparkles,   title: 'Export & import',       body: 'Bewaar volledige scenario\'s als JSON. Vergelijk wat-als situaties zonder data te verliezen.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-[#0a0a0d] border border-white/[0.06] rounded-2xl p-7">
                <Icon size={16} className="text-orange-400 mb-4" />
                <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-24 border-t border-white/[0.06]">
          <div className="relative bg-gradient-to-br from-[#0d0d12] to-[#08080b] border border-white/[0.08] rounded-3xl p-12 lg:p-16 overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/20 via-violet-500/10 to-transparent blur-3xl" />
            </div>
            <div className="relative text-center max-w-2xl mx-auto">
              <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight text-white">
                Klaar om de cijfers <br className="hidden sm:block" />
                <span className="text-slate-500">te zien?</span>
              </h2>
              <p className="mt-5 text-slate-400 leading-relaxed">
                Geen registratie nodig. Vul je gegevens in op de tabs links —
                resultaten verschijnen live aan de rechterkant.
              </p>
              <button
                onClick={onGetStarted}
                className="mt-9 inline-flex items-center gap-2 bg-white text-black hover:bg-slate-200 transition-colors font-medium text-sm rounded-lg px-6 py-3 cursor-pointer border-0"
              >
                Open de app
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>

        <footer className="py-10 border-t border-white/[0.06] text-center">
          <p className="text-xs text-slate-600">
            Indicatieve berekening o.b.v. belastingregels 2026. Geen vervanging voor professioneel advies.
          </p>
        </footer>
      </main>
    </div>
  );
}
