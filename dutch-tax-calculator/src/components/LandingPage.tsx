import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Lock, Zap, HardDrive, ChevronDown } from 'lucide-react';

type Tab = string;
interface TabMeta { id: Tab; emoji: string; description: string }

interface Props {
  ALL_TABS: TabMeta[];
  TAB_LABELS: Record<Tab, string>;
  enabledTabs: Set<Tab>;
  toggleTab: (id: Tab) => void;
  setTab: (id: Tab | 'home') => void;
  lang: 'nl' | 'en';
  t: {
    home: {
      taxYear: string; welcome: string; subtitle: string; viewGuide: string;
      yourTabs: string; toggleHint: string; active: string; openTab: string;
      localTitle: string; localDesc: string; liveTitle: string; liveDesc: string;
      autoSaveTitle: string; autoSaveDesc: string;
    };
  };
}

/* ── Per-module spotlight data ───────────────────────────────────────────── */
const SPOT: Record<string, {
  cat: { nl: string; en: string };
  catCls: string;
  calc: { nl: string; en: string };
  result: string;
  lbl: { nl: string; en: string };
}> = {
  income:         { cat:{nl:'Box 1 · Inkomen',en:'Box 1 · Income'},       catCls:'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800',        calc:{nl:'Bruto €65.000 / jaar',en:'Gross €65,000 / year'},          result:'€3.494',  lbl:{nl:'/ maand netto',en:'/ month net'} },
  woon:           { cat:{nl:'Box 1 · Wonen',en:'Box 1 · Housing'},         catCls:'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800', calc:{nl:'Hypotheek €280k @ 3,8%',en:'Mortgage €280k @ 3.8%'},          result:'€3.527',  lbl:{nl:'HRA besparing / jaar',en:'HRA saving / year'} },
  waardes:        { cat:{nl:'Box 3 · Vermogen',en:'Box 3 · Wealth'},       catCls:'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800', calc:{nl:'Beleg €60k + spaar €40k',en:'Invest €60k + save €40k'},        result:'€535',    lbl:{nl:'Box 3 belasting / jr',en:'Box 3 tax / year'} },
  expenses:       { cat:{nl:'Budget',en:'Budget'},                          catCls:'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800',             calc:{nl:'Netto €3.500 / maand',en:'Net €3,500 / month'},               result:'23%',     lbl:{nl:'spaarquote',en:'savings rate'} },
  schulden:       { cat:{nl:'Schulden',en:'Debts'},                         catCls:'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',       calc:{nl:'DUO €28k @ 2,56%',en:'Student loan €28k @ 2.56%'},            result:'€880',    lbl:{nl:'/ jaar aflossing',en:'/ year repaid'} },
  bank:           { cat:{nl:'Bankrekeningen',en:'Bank accounts'},           catCls:'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800',             calc:{nl:'Spaarrekening €22k @ 2,1%',en:'Savings €22k @ 2.1%'},         result:'€462',    lbl:{nl:'rente / jaar',en:'interest / year'} },
  portfolio:      { cat:{nl:'Beleggen',en:'Investing'},                     catCls:'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800', calc:{nl:'100× VWRL @ €85 → €112',en:'100× VWRL @ €85 → €112'},      result:'+€2.700', lbl:{nl:'ongerealiseerde winst',en:'unrealised gain'} },
  afschrijvingen: { cat:{nl:'Planning',en:'Planning'},                      catCls:'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',      calc:{nl:'Auto €22k in 7 jaar',en:'Car €22k in 7 years'},               result:'€245',    lbl:{nl:'/ maand reserveren',en:'/ month to save'} },
  schenkingen:    { cat:{nl:'Belasting',en:'Tax'},                          catCls:'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800', calc:{nl:'Schenking €40k (ouders)',en:'Gift €40k (parents)'},            result:'€676',    lbl:{nl:'schenkbelasting',en:'gift tax'} },
  jaarruimte:     { cat:{nl:'Pensioen',en:'Pension'},                       catCls:'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',       calc:{nl:'Inkomen €65k · Factor A €1.400',en:'Income €65k · Factor A €1,400'}, result:'€4.626', lbl:{nl:'belastingbesparing',en:'tax saving'} },
  prognose:       { cat:{nl:'30-jaar Prognose',en:'30-year Forecast'},      catCls:'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800', calc:{nl:'€700/mnd · 7% rendement',en:'€700/mo · 7% return'},           result:'2041',    lbl:{nl:'verwacht FI-jaar',en:'expected FI year'} },
  results:        { cat:{nl:'Overzicht',en:'Overview'},                     catCls:'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',             calc:{nl:'Bruto €65k + WOZ €350k',en:'Gross €65k + property €350k'},    result:'€3.860',  lbl:{nl:'/ maand beschikbaar',en:'/ month available'} },
  marginale:      { cat:{nl:'Analyse',en:'Analysis'},                       catCls:'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/30 border-fuchsia-200 dark:border-fuchsia-800', calc:{nl:'Inkomen €40k → €41k',en:'Income €40k → €41k'},            result:'49%',     lbl:{nl:'marginaal tarief',en:'marginal rate'} },
};

const CYCLE_MS = 4000;

/* ── Hooks ───────────────────────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function useCountUp(target: number, duration: number, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number | null = null; let raf: number;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return val;
}

/* ── Reveal style helper (Jakub recipe: opacity + translateY + blur) ── */
function rv(on: boolean, delayMs = 0): React.CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : 'translateY(16px)',
    filter: on ? 'blur(0px)' : 'blur(4px)',
    transition: `opacity 480ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms,
                 transform 480ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms,
                 filter 480ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms`,
  };
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function LandingPage({ ALL_TABS, TAB_LABELS, enabledTabs, setTab, lang, t }: Props) {
  const nl = lang === 'nl';

  /* Hero entrance */
  const [heroIn, setHeroIn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setHeroIn(true), 60); return () => clearTimeout(id); }, []);

  /* Module carousel */
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused]       = useState(false);
  const [cycleKey, setCycleKey]   = useState(0); // resets CSS progress bar

  /* Spotlight cross-dissolve */
  const [shownIdx, setShownIdx]   = useState(0);
  const [spotOpacity, setSpotOpacity] = useState(1);

  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* Auto-cycle */
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % ALL_TABS.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [paused, ALL_TABS.length]);

  /* Cross-dissolve when activeIdx changes */
  useEffect(() => {
    setSpotOpacity(0);
    const id = setTimeout(() => {
      setShownIdx(activeIdx);
      setCycleKey(k => k + 1);
      setSpotOpacity(1);
      pillRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 160);
    return () => clearTimeout(id);
  }, [activeIdx]);

  const jumpTo = useCallback((idx: number) => {
    setActiveIdx(idx);
    setPaused(false);
  }, []);

  /* Sample calculation scroll reveals */
  const [calcRef, calcIn] = useInView();
  const [featsRef, featsIn] = useInView();

  const v1 = useCountUp(3494, 1200, calcIn);
  const v2 = useCountUp(535,  1000, calcIn);
  const v3 = useCountUp(2041, 1400, calcIn);

  const tab = ALL_TABS[shownIdx];
  const spot = SPOT[tab?.id] ?? SPOT['income'];

  return (
    <div className="lp-root">

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-hero">
        {/* decorative blobs */}
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none animate-float-1" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-amber-300/20 blur-3xl pointer-events-none animate-float-2" />
        <div className="shimmer-sweep" />

        <div className="relative lp-hero-inner">
          {/* Badge */}
          <div style={rv(heroIn, 0)}>
            <div className="lp-badge">
              <span className="lp-badge-dot" />
              {t.home.taxYear} · Live
            </div>
          </div>

          {/* Headline */}
          <h1 className="lp-headline" style={rv(heroIn, 70)}>
            {nl
              ? <><span className="block">Jouw volledige</span><span className="block lp-headline-light">belasting&shy;berekening</span><span className="block">in één scherm.</span></>
              : <><span className="block">Your complete</span><span className="block lp-headline-light">Dutch tax</span><span className="block">calculation.</span></>
            }
          </h1>

          {/* Subtitle */}
          <p className="lp-subtitle" style={rv(heroIn, 160)}>
            {nl
              ? 'Box 1, Box 3, toeslagen, hypotheek, DUO, portfolio en 30-jaar FIRE-prognose — alles live berekend, niets naar een server.'
              : 'Box 1, Box 3, allowances, mortgage, student debt, portfolio and 30-year FIRE projection — all live, nothing to a server.'
            }
          </p>

          {/* CTAs */}
          <div className="lp-ctas" style={rv(heroIn, 240)}>
            <button
              onClick={() => setTab('income')}
              className="lp-cta-primary group"
            >
              {nl ? 'Start berekening' : 'Start calculator'}
              <ArrowRight size={15} className="lp-cta-arrow" />
            </button>
            <a href="#modules" className="lp-cta-ghost">
              {nl ? 'Bekijk alle modules' : 'View all modules'}
              <ChevronDown size={14} />
            </a>
          </div>

          {/* Quick stats */}
          <div className="lp-stats" style={rv(heroIn, 330)}>
            {[
              { v: '13', l: nl ? 'modules' : 'modules' },
              { v: '30j', l: nl ? 'prognose' : 'forecast' },
              { v: '0', l: nl ? 'cloud data' : 'cloud data' },
              { v: 'Live', l: nl ? 'berekening' : 'calculation', accent: true },
            ].map(s => (
              <div key={s.l} className={`lp-stat ${s.accent ? 'lp-stat-accent' : ''}`}>
                <span className="lp-stat-value">{s.v}</span>
                <span className="lp-stat-label">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ MODULE SHOWCASE ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="modules" className="lp-section">
        <div className="lp-section-header">
          <div>
            <h2 className="lp-section-title">
              {nl ? '13 modules. Eén berekening.' : '13 modules. One calculation.'}
            </h2>
            <p className="lp-section-sub">
              {nl
                ? 'Elke tab voedt dezelfde motor — klik een module om te zien wat het berekent.'
                : 'Every tab feeds the same engine — click a module to see what it calculates.'
              }
            </p>
          </div>
        </div>

        <div
          className="lp-carousel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Left: pill list */}
          <div className="lp-pill-list" role="tablist">
            {ALL_TABS.map((m, i) => (
              <button
                key={m.id}
                ref={el => { pillRefs.current[i] = el; }}
                role="tab"
                aria-selected={i === activeIdx}
                onClick={() => jumpTo(i)}
                className={`lp-pill ${i === activeIdx ? 'lp-pill-active' : ''}`}
              >
                <span className="lp-pill-emoji">{m.emoji}</span>
                <span className="lp-pill-name">{TAB_LABELS[m.id]}</span>
                {!enabledTabs.has(m.id) && (
                  <span className="lp-pill-off">{nl ? 'Uit' : 'Off'}</span>
                )}
              </button>
            ))}
          </div>

          {/* Right: spotlight */}
          <div className="lp-spotlight-wrap">
            <div
              className="lp-spotlight"
              style={{
                opacity: spotOpacity,
                filter: spotOpacity < 1 ? 'blur(3px)' : 'blur(0px)',
                transition: 'opacity 160ms cubic-bezier(0.22,1,0.36,1), filter 160ms cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              {/* Category chip */}
              <div className={`lp-cat-chip ${spot.catCls}`}>
                {nl ? spot.cat.nl : spot.cat.en}
              </div>

              {/* Module identity */}
              <div className="lp-spot-identity">
                <span className="lp-spot-emoji">{tab?.emoji}</span>
                <h3 className="lp-spot-name">{tab ? TAB_LABELS[tab.id] : ''}</h3>
              </div>

              {/* Description */}
              <p className="lp-spot-desc">{tab?.description}</p>

              {/* Mini calculation */}
              <div className="lp-mini-calc">
                <div className="lp-mini-calc-row">
                  <span className="lp-mini-label">{nl ? 'Voorbeeld' : 'Example'}</span>
                  <span className="lp-mini-input">{nl ? spot.calc.nl : spot.calc.en}</span>
                </div>
                <div className="lp-mini-divider" />
                <div className="lp-mini-result-row">
                  <span className="lp-mini-result">{spot.result}</span>
                  <span className="lp-mini-result-label">{nl ? spot.lbl.nl : spot.lbl.en}</span>
                </div>
              </div>

              {/* Open button */}
              {tab && (
                <button
                  onClick={() => setTab(tab.id)}
                  className="lp-spot-open group"
                >
                  {enabledTabs.has(tab.id)
                    ? `${nl ? 'Open' : 'Open'} ${TAB_LABELS[tab.id]}`
                    : nl ? `${TAB_LABELS[tab.id]} inschakelen` : `Enable ${TAB_LABELS[tab.id]}`
                  }
                  <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              )}
            </div>

            {/* Progress bar — key forces restart */}
            <div className="lp-progress-track" aria-hidden>
              <div
                key={cycleKey}
                className={`lp-progress-bar ${paused ? 'lp-progress-paused' : ''}`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━ SAMPLE CALCULATIONS ━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-section lp-section-dark" ref={calcRef}>
        <div className="lp-section-header">
          <h2 className="lp-section-title">
            {nl ? 'Zo ziet een berekening eruit.' : 'What a calculation looks like.'}
          </h2>
          <p className="lp-section-sub">
            {nl
              ? 'Vul je gegevens in — resultaten verschijnen direct, zonder te klikken.'
              : 'Enter your data — results appear instantly, no button needed.'
            }
          </p>
        </div>

        <div className="lp-calc-grid">

          {/* Box 1 */}
          <div className="lp-calc-card lp-calc-box1" style={rv(calcIn, 0)}>
            <div className="lp-calc-tag lp-tag-blue">Box 1 — {nl ? 'Inkomen' : 'Income'}</div>
            <div className="lp-calc-scenario">
              <div className="lp-calc-line">
                <span>{nl ? 'Bruto jaarsalaris' : 'Gross annual salary'}</span>
                <span className="lp-calc-amount">€65.000</span>
              </div>
              <div className="lp-calc-line lp-calc-deduct">
                <span>{nl ? '− Pensioenpremie' : '− Pension contribution'}</span>
                <span className="lp-calc-amount">€5.500</span>
              </div>
              <div className="lp-calc-line lp-calc-deduct">
                <span>{nl ? '− Box 1 belasting' : '− Box 1 tax'}</span>
                <span className="lp-calc-amount">€17.572</span>
              </div>
              <div className="lp-calc-line lp-calc-deduct">
                <span>{nl ? '− Heffingskortingen' : '− Tax credits'}</span>
                <span className="lp-calc-amount">€4.096</span>
              </div>
            </div>
            <div className="lp-calc-result">
              <span className="lp-calc-result-label">{nl ? 'Netto maandinkomen' : 'Net monthly income'}</span>
              <span className="lp-calc-big lp-big-blue">
                €{v1.toLocaleString('nl-NL')}
                <span className="lp-calc-unit">/mnd</span>
              </span>
            </div>
          </div>

          {/* Box 3 */}
          <div className="lp-calc-card lp-calc-box3" style={rv(calcIn, 100)}>
            <div className="lp-calc-tag lp-tag-violet">Box 3 — {nl ? 'Vermogen' : 'Wealth'}</div>
            <div className="lp-calc-scenario">
              <div className="lp-calc-line">
                <span>{nl ? 'Beleggingen (5,88%)' : 'Investments (5.88%)'}</span>
                <span className="lp-calc-amount">€60.000</span>
              </div>
              <div className="lp-calc-line">
                <span>{nl ? 'Spaargeld (1,03%)' : 'Savings (1.03%)'}</span>
                <span className="lp-calc-amount">€40.000</span>
              </div>
              <div className="lp-calc-line lp-calc-deduct">
                <span>{nl ? '− Heffingsvrijvermogen' : '− Tax-free threshold'}</span>
                <span className="lp-calc-amount">€57.684</span>
              </div>
              <div className="lp-calc-line">
                <span>{nl ? 'Tarief 36% over grondslag' : '36% rate over base'}</span>
                <span className="lp-calc-amount">→</span>
              </div>
            </div>
            <div className="lp-calc-result">
              <span className="lp-calc-result-label">{nl ? 'Box 3 belasting' : 'Box 3 tax'}</span>
              <span className="lp-calc-big lp-big-violet">
                €{v2.toLocaleString('nl-NL')}
                <span className="lp-calc-unit">/jr</span>
              </span>
            </div>
          </div>

          {/* FIRE Prognose */}
          <div className="lp-calc-card lp-calc-fire" style={rv(calcIn, 200)}>
            <div className="lp-calc-tag lp-tag-orange">30jr {nl ? 'Prognose · FIRE' : 'Forecast · FIRE'}</div>
            <div className="lp-calc-scenario">
              <div className="lp-calc-line">
                <span>{nl ? 'Huidig vermogen' : 'Current wealth'}</span>
                <span className="lp-calc-amount">€120.000</span>
              </div>
              <div className="lp-calc-line">
                <span>{nl ? 'Maandelijks beleggen' : 'Monthly investment'}</span>
                <span className="lp-calc-amount">€700</span>
              </div>
              <div className="lp-calc-line">
                <span>{nl ? 'Verwacht rendement' : 'Expected return'}</span>
                <span className="lp-calc-amount">7%</span>
              </div>
              <div className="lp-calc-line">
                <span>{nl ? 'FIRE-drempel (4% SWR)' : 'FIRE threshold (4% SWR)'}</span>
                <span className="lp-calc-amount">€750k</span>
              </div>
            </div>
            <div className="lp-calc-result">
              <span className="lp-calc-result-label">{nl ? 'Verwacht FI-jaar' : 'Expected FI year'}</span>
              <span className="lp-calc-big lp-big-orange">
                {v3 > 0 ? v3 : '—'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TRUST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-section" ref={featsRef}>
        <div className="lp-feats-grid">
          {[
            { Icon: Lock,     title: t.home.localTitle,     desc: t.home.localDesc,     cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30', delay: 0 },
            { Icon: Zap,      title: t.home.liveTitle,      desc: t.home.liveDesc,      cls: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',           delay: 80 },
            { Icon: HardDrive,title: t.home.autoSaveTitle,  desc: t.home.autoSaveDesc,  cls: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30',    delay: 160 },
          ].map(({ Icon, title, desc, cls, delay }) => (
            <div key={title} className="lp-feat" style={rv(featsIn, delay)}>
              <div className={`lp-feat-icon ${cls}`}><Icon size={17} /></div>
              <div>
                <p className="lp-feat-title">{title}</p>
                <p className="lp-feat-desc">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-cta-section">
        <h2 className="lp-cta-headline">
          {nl ? 'Klaar om te beginnen?' : 'Ready to start?'}
        </h2>
        <p className="lp-cta-sub">
          {nl
            ? 'Vul je inkomen in bij het eerste tabblad — de belastingberekening start meteen.'
            : 'Enter your income on the first tab — the tax calculation starts immediately.'
          }
        </p>
        <button onClick={() => setTab('income')} className="lp-cta-primary group lp-cta-big">
          {nl ? 'Start met Inkomen' : 'Start with Income'}
          <ArrowRight size={16} className="lp-cta-arrow" />
        </button>
      </section>
    </div>
  );
}
