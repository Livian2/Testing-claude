import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowRight, X, Flag, Shield, Zap, HardDrive, TrendingUp, TrendingDown, Flame } from 'lucide-react';
import {
  PanelCard, StatTile, StatGrid, PanelSection, KeyValueRow,
  BracketBar, ProgressBar, ResultBar, InteractiveAreaChart,
  type ChartPoint,
} from './shared/Showcase';

type Tab = string;
interface TabMeta { id: Tab; emoji: string; description: string }

interface Props {
  ALL_TABS: TabMeta[];
  TAB_LABELS: Record<Tab, string>;
  enabledTabs: Set<Tab>;
  lang: 'nl' | 'en';
  t: {
    home: {
      taxYear: string; welcome: string; subtitle: string; viewGuide: string;
      yourTabs: string; toggleHint: string; active: string; openTab: string;
      localTitle: string; localDesc: string; liveTitle: string; liveDesc: string;
      autoSaveTitle: string; autoSaveDesc: string;
    };
  };
  onClose: () => void;
  onOpenTab: (id: Tab) => void;
  setLang: (l: 'nl' | 'en') => void;
}

/* ── Module spotlight data ──────────────────────────────────────────────── */
const SPOT: Record<string, {
  cat: { nl: string; en: string };
  dot: string;
  calc: { nl: string; en: string };
  result: string;
  lbl: { nl: string; en: string };
}> = {
  income:         { cat:{nl:'Box 1 · Inkomen',en:'Box 1 · Income'},        dot:'#38bdf8', calc:{nl:'Bruto €60.000 / jaar',en:'Gross €60,000 / year'},               result:'€3.673',  lbl:{nl:'netto / maand',en:'net / month'} },
  woon:           { cat:{nl:'Box 1 · Wonen',en:'Box 1 · Housing'},          dot:'#f97316', calc:{nl:'Hypotheek €280k @ 3,8%',en:'Mortgage €280k @ 3.8%'},             result:'€3.527',  lbl:{nl:'HRA besparing / jr',en:'HRA saving / yr'} },
  waardes:        { cat:{nl:'Box 3 · Vermogen',en:'Box 3 · Wealth'},        dot:'#a78bfa', calc:{nl:'Belegg. €60k + spaar €40k',en:'Invest €60k + save €40k'},        result:'€600',    lbl:{nl:'Box 3 belasting / jr',en:'Box 3 tax / yr'} },
  expenses:       { cat:{nl:'Budget',en:'Budget'},                           dot:'#f43f5e', calc:{nl:'Kosten €1.500 + sparen €300/mnd',en:'Costs €1,500 + savings €300/mo'}, result:'€1.800',  lbl:{nl:'maandelijks totaal',en:'monthly total'} },
  schulden:       { cat:{nl:'Schulden',en:'Debts'},                          dot:'#fbbf24', calc:{nl:'DUO €28k @ 2,56%',en:'Student loan €28k @ 2.56%'},               result:'€880',    lbl:{nl:'/ jaar aflossing',en:'/ year repaid'} },
  bank:           { cat:{nl:'Bankrekeningen',en:'Bank accounts'},            dot:'#2dd4bf', calc:{nl:'Spaarrekening €22k @ 2,1%',en:'Savings €22k @ 2.1%'},            result:'€462',    lbl:{nl:'rente / jaar',en:'interest / yr'} },
  portfolio:      { cat:{nl:'Beleggen',en:'Investing'},                      dot:'#34d399', calc:{nl:'100× VWRL @ €85 → €112',en:'100× VWRL @ €85 → €112'},           result:'+€2.700', lbl:{nl:'ongerealiseerde winst',en:'unrealised gain'} },
  afschrijvingen: { cat:{nl:'Planning',en:'Planning'},                       dot:'#94a3b8', calc:{nl:'Auto €22k, 7 jaar',en:'Car €22k, 7 years'},                      result:'€245',    lbl:{nl:'/ maand reserveren',en:'/ month to save'} },
  schenkingen:    { cat:{nl:'Belasting',en:'Tax'},                           dot:'#c084fc', calc:{nl:'Schenking €40k (ouders)',en:'Gift €40k (parents)'},               result:'€676',    lbl:{nl:'schenkbelasting',en:'gift tax'} },
  jaarruimte:     { cat:{nl:'Pensioen',en:'Pension'},                        dot:'#fb923c', calc:{nl:'Inkomen €65k · Factor A €1.400',en:'Income €65k · Factor A €1,400'}, result:'€4.626', lbl:{nl:'belastingbesparing',en:'tax saving'} },
  prognose:       { cat:{nl:'30-jaar Prognose',en:'30-year Forecast'},       dot:'#f97316', calc:{nl:'€200k + €700/mnd · €2.500 uitgaven · 7%',en:'€200k + €700/mo · €2,500 expenses · 7%'}, result:'2041',    lbl:{nl:'verwacht FI-jaar (4% SWR)',en:'expected FI year (4% SWR)'} },
  results:        { cat:{nl:'Belastingoverzicht',en:'Tax Overview'},         dot:'#60a5fa', calc:{nl:'Bruto €65k + WOZ €350k',en:'Gross €65k + property €350k'},       result:'€3.860',  lbl:{nl:'/ maand beschikbaar',en:'/ month available'} },
  marginale:      { cat:{nl:'Analyse',en:'Analysis'},                        dot:'#e879f9', calc:{nl:'Inkomen €40k → €41k',en:'Income €40k → €41k'},                  result:'49%',     lbl:{nl:'marginaal tarief',en:'marginal rate'} },
};

const CYCLE_MS = 4200;

/* ── Hooks ──────────────────────────────────────────────────────────────── */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } }, { threshold });
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return [ref, v] as const;
}

function useCountUp(target: number, duration: number, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let s: number | null = null; let raf: number;
    const tick = (ts: number) => {
      if (!s) s = ts;
      const p = Math.min((ts - s) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return val;
}

function rv(on: boolean, d = 0): React.CSSProperties {
  return {
    opacity: on ? 1 : 0, transform: on ? 'translateY(0)' : 'translateY(20px)',
    filter: on ? 'blur(0)' : 'blur(5px)',
    transition: `opacity 560ms cubic-bezier(0.22,1,0.36,1) ${d}ms, transform 560ms cubic-bezier(0.22,1,0.36,1) ${d}ms, filter 560ms cubic-bezier(0.22,1,0.36,1) ${d}ms`,
  };
}

/* ── Component ──────────────────────────────────────────────────────────── */
export default function LandingPage({ ALL_TABS, TAB_LABELS, enabledTabs, lang, t, onClose, onOpenTab, setLang }: Props) {
  const nl = lang === 'nl';
  const [heroIn, setHeroIn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setHeroIn(true), 60); return () => clearTimeout(id); }, []);

  /* Carousel */
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);
  const [spotOpacity, setSpotOpacity] = useState(1);
  const [shownIdx, setShownIdx] = useState(0);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActiveIdx(p => (p + 1) % ALL_TABS.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [paused, ALL_TABS.length]);

  useEffect(() => {
    setSpotOpacity(0);
    const id = setTimeout(() => { setShownIdx(activeIdx); setCycleKey(k => k + 1); setSpotOpacity(1); }, 170);
    return () => clearTimeout(id);
  }, [activeIdx]);

  const jumpTo = useCallback((i: number) => { setActiveIdx(i); setPaused(false); }, []);

  /* Scroll reveals */
  const [modsRef, modsIn] = useInView();
  const [calcRef, calcIn] = useInView();
  const [trustRef, trustIn] = useInView();
  const [ctaRef, ctaIn] = useInView(0.3);

  const v1 = useCountUp(3673, 1200, calcIn);
  const v2 = useCountUp(600,  1000, calcIn);
  const v3 = useCountUp(2041, 1400, calcIn);

  /* FIRE projection — €200k start, €700/mo invested, 7% return, 4% SWR on €2.5k/mo */
  const fireSeries = useMemo<ChartPoint[]>(() => {
    const startYear = 2026;
    const startCap  = 200_000;
    const monthly   = 700 * 12;
    const ret       = 0.07;
    const pts: ChartPoint[] = [];
    let bal = startCap;
    for (let i = 0; i <= 15; i++) {
      pts.push({ x: startYear + i, y: bal, label: String(startYear + i) });
      bal = bal * (1 + ret) + monthly;
    }
    return pts;
  }, []);

  const tab = ALL_TABS[shownIdx];
  const spot = SPOT[tab?.id] ?? SPOT['income'];

  return (
    <div className="lp2-root">
      {/* Ambient background glow */}
      <div className="lp2-glow-tl" aria-hidden />
      <div className="lp2-glow-br" aria-hidden />

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header className="lp2-nav">
        <div className="lp2-nav-inner">
          <div className="lp2-nav-brand">
            <div className="lp2-brand-chip">
              <Flag size={13} />
              <span>NL Belasting</span>
            </div>
            <span className="lp2-nav-label">{nl ? 'Uitleg' : 'Guide'}</span>
          </div>
          <div className="lp2-nav-actions">
            <button
              onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
              className="lp2-lang-btn"
            >
              {lang === 'nl' ? '🇬🇧 EN' : '🇳🇱 NL'}
            </button>
            <button onClick={() => onOpenTab('income' as Tab)} className="lp2-nav-cta">
              {nl ? 'Open calculator' : 'Open calculator'}
              <ArrowRight size={12} />
            </button>
            <button onClick={onClose} className="lp2-nav-close" aria-label={nl ? 'Sluiten' : 'Close'}>
              <X size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="lp2-scroll">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="lp2-hero">
          <div className="lp2-hero-dots" aria-hidden />

          <div className="lp2-hero-inner">
            {/* Year tag */}
            <div style={rv(heroIn, 0)}>
              <div className="lp2-year-tag">
                <span className="lp2-year-dot" />
                {t.home.taxYear}
              </div>
            </div>

            {/* Headline */}
            <h1 className="lp2-headline" style={rv(heroIn, 70)}>
              {nl ? (
                <>Jouw <span className="lp2-headline-em">belasting</span><br />in één scherm.</>
              ) : (
                <>Your <span className="lp2-headline-em">Dutch tax</span><br />in one screen.</>
              )}
            </h1>

            {/* Subtitle */}
            <p className="lp2-sub" style={rv(heroIn, 160)}>
              {nl
                ? 'Box 1, Box 3, toeslagen, hypotheek, DUO, portfolio en 30-jaar prognose — berekend volgens de officiële regels. Alles lokaal.'
                : 'Box 1, Box 3, allowances, mortgage, student debt, portfolio and 30-year projection — calculated per official rules. All local.'}
            </p>

            {/* Stats row */}
            <div className="lp2-stats" style={rv(heroIn, 250)}>
              {[
                { v: '13', l: nl ? 'modules' : 'modules' },
                { v: '30j', l: nl ? 'prognose' : 'forecast' },
                { v: '0', l: nl ? 'naar cloud' : 'to cloud' },
                { v: 'Live', l: nl ? 'berekening' : 'calculation' },
              ].map(s => (
                <div key={s.l} className="lp2-stat">
                  <span className="lp2-stat-v">{s.v}</span>
                  <span className="lp2-stat-l">{s.l}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="lp2-ctas" style={rv(heroIn, 340)}>
              <button onClick={() => onOpenTab('income' as Tab)} className="lp2-cta-primary group">
                {nl ? 'Start berekening' : 'Start calculator'}
                <ArrowRight size={14} className="lp2-arrow" />
              </button>
              <a href="#lp2-modules" className="lp2-cta-ghost">
                {nl ? 'Bekijk modules ↓' : 'View modules ↓'}
              </a>
            </div>
          </div>

          {/* Large decorative number strip */}
          <div className="lp2-number-strip" aria-hidden>
            <span>€3.494</span>
            <span className="lp2-strip-sep">·</span>
            <span>€535</span>
            <span className="lp2-strip-sep">·</span>
            <span>2041</span>
          </div>
        </section>

        {/* ── MODULE SHOWCASE ──────────────────────────────────────────────── */}
        <section id="lp2-modules" className="lp2-section" ref={modsRef}>
          <div className="lp2-section-label" style={rv(modsIn, 0)}>
            {nl ? '// modules' : '// modules'}
          </div>
          <h2 className="lp2-section-heading" style={rv(modsIn, 60)}>
            {nl ? '13 onderdelen. Eén berekening.' : '13 modules. One calculation.'}
          </h2>
          <p className="lp2-section-sub" style={rv(modsIn, 120)}>
            {nl ? 'Elke tab voedt dezelfde motor. Klik een module voor het voorbeeld.' : 'Every tab feeds the same engine. Click a module to see the example.'}
          </p>

          <div
            className="lp2-carousel"
            style={{ ...rv(modsIn, 180) }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {/* Left: module list */}
            <div className="lp2-modlist" role="tablist">
              {ALL_TABS.map((m, i) => {
                const s = SPOT[m.id];
                const isActive = i === activeIdx;
                return (
                  <button
                    key={m.id}
                    ref={el => { pillRefs.current[i] = el; }}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => jumpTo(i)}
                    className={`lp2-mod-row ${isActive ? 'lp2-mod-active' : ''}`}
                  >
                    <span className="lp2-mod-dot" style={{ background: s?.dot ?? '#f97316' }} />
                    <span className="lp2-mod-emoji">{m.emoji}</span>
                    <span className="lp2-mod-name">{TAB_LABELS[m.id]}</span>
                    <span className="lp2-mod-result">{s?.result ?? ''}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: spotlight */}
            <div className="lp2-spotlight-outer">
              <div
                className="lp2-spotlight"
                style={{
                  opacity: spotOpacity,
                  filter: spotOpacity < 1 ? 'blur(4px)' : 'blur(0)',
                  transition: 'opacity 170ms cubic-bezier(0.22,1,0.36,1), filter 170ms cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                {/* Big result number */}
                <div className="lp2-spot-result">
                  <span className="lp2-spot-num" style={{ color: spot.dot }}>{spot.result}</span>
                  <span className="lp2-spot-lbl">{nl ? spot.lbl.nl : spot.lbl.en}</span>
                </div>

                {/* Module identity */}
                <div className="lp2-spot-meta">
                  <span className="lp2-spot-cat" style={{ color: spot.dot, borderColor: `${spot.dot}40`, background: `${spot.dot}12` }}>
                    {nl ? spot.cat.nl : spot.cat.en}
                  </span>
                </div>
                <div className="lp2-spot-title">
                  <span className="lp2-spot-emoji">{tab?.emoji}</span>
                  <span className="lp2-spot-name">{tab ? TAB_LABELS[tab.id] : ''}</span>
                </div>

                <p className="lp2-spot-desc">{tab?.description}</p>

                {/* Calculation */}
                <div className="lp2-spot-calc">
                  <div className="lp2-spot-calc-row">
                    <span className="lp2-spot-calc-lbl">{nl ? 'Invoer' : 'Input'}</span>
                    <span className="lp2-spot-calc-val">{nl ? spot.calc.nl : spot.calc.en}</span>
                  </div>
                  <div className="lp2-spot-calc-arrow">↓</div>
                  <div className="lp2-spot-calc-output" style={{ borderColor: `${spot.dot}30` }}>
                    <span style={{ color: spot.dot, fontWeight: 800 }}>{spot.result}</span>
                    <span className="lp2-spot-calc-out-lbl">{nl ? spot.lbl.nl : spot.lbl.en}</span>
                  </div>
                </div>

                {tab && (
                  <button onClick={() => onOpenTab(tab.id)} className="lp2-spot-open group">
                    {enabledTabs.has(tab.id)
                      ? `${nl ? 'Open' : 'Open'} ${TAB_LABELS[tab.id]}`
                      : nl ? `${TAB_LABELS[tab.id]} inschakelen` : `Enable ${TAB_LABELS[tab.id]}`}
                    <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                )}
              </div>

              {/* Progress track */}
              <div className="lp2-progress-track" aria-hidden>
                <div key={cycleKey} className={`lp2-progress-fill ${paused ? 'lp2-paused' : ''}`} />
              </div>
            </div>
          </div>
        </section>

        {/* ── SAMPLE CALCULATIONS ──────────────────────────────────────────── */}
        <section className="lp2-section lp2-section-alt" ref={calcRef}>
          <div className="lp2-section-label" style={rv(calcIn, 0)}>{nl ? '// berekeningen' : '// calculations'}</div>
          <h2 className="lp2-section-heading" style={rv(calcIn, 60)}>
            {nl ? 'Zo ziet een resultaat eruit.' : 'What a result looks like.'}
          </h2>

          <div className="lp2-calc-grid">

            {/* ── Box 1 ── */}
            <div style={rv(calcIn, 0)} className="text-slate-200">
              <PanelCard
                accent="#60a5fa"
                icon={<TrendingUp size={15} />}
                title={`Box 1 · ${nl ? 'Inkomen' : 'Income'}`}
                footer={
                  <ResultBar
                    label={nl ? 'Netto maandinkomen' : 'Net monthly income'}
                    value={`€${v1.toLocaleString('nl-NL')}`}
                    accent="#60a5fa"
                    suffix="/mnd"
                  />
                }
              >
                <StatGrid>
                  <StatTile label={nl ? 'Belastbaar inkomen' : 'Taxable income'} value="€60.000" accent="#93c5fd" animateOnMount />
                  <StatTile label={nl ? 'Bruto belasting'    : 'Gross tax'}      value="€21.850" accent="#fdba74" animateOnMount />
                  <StatTile label={nl ? 'Effectief tarief'   : 'Effective rate'} value="26,5%"   accent="#cbd5e1" animateOnMount />
                  <StatTile label={nl ? 'Netto belasting'    : 'Net tax'}        value="€15.925" accent="#fca5a5" animateOnMount />
                </StatGrid>
                <PanelSection title={nl ? 'Belastingschijven' : 'Tax brackets'}>
                  <BracketBar rate="35,75%" width={64} base="€38.883" tax="€13.901" accent="#60a5fa" />
                  <BracketBar rate="37,56%" width={36} base="€21.117" tax="€7.931"  accent="#60a5fa" />
                </PanelSection>
                <PanelSection title={nl ? 'Heffingskortingen' : 'Tax credits'} tint accent="#4ade80">
                  <KeyValueRow label={nl ? 'Alg. heffingskorting' : 'General credit'} value="− €3.115" accent="#4ade80" />
                  <KeyValueRow label={nl ? 'Arbeidskorting' : 'Labour credit'}        value="− €5.300" accent="#4ade80" last />
                </PanelSection>
              </PanelCard>
            </div>

            {/* ── Box 3 ── */}
            <div style={rv(calcIn, 80)} className="text-slate-200">
              <PanelCard
                accent="#c084fc"
                icon={<TrendingDown size={15} />}
                title={`Box 3 · ${nl ? 'Vermogen' : 'Wealth'}`}
                footer={
                  <ResultBar
                    label={nl ? 'Box 3 belasting' : 'Box 3 tax'}
                    value={`€${v2}`}
                    accent="#c084fc"
                    suffix="/jr"
                  />
                }
              >
                <StatGrid>
                  <StatTile label={nl ? 'Spaargeld'    : 'Savings'}     value="€40.000" accent="#d8b4fe" animateOnMount />
                  <StatTile label={nl ? 'Beleggingen'  : 'Investments'} value="€60.000" accent="#d8b4fe" animateOnMount />
                  <StatTile label={nl ? 'Vrijstelling' : 'Exemption'}   value="€57.684" accent="#86efac" animateOnMount />
                  <StatTile label={nl ? 'Box 3 belasting' : 'Box 3 tax'} value={`€${v2}`} accent="#fca5a5" animateOnMount />
                </StatGrid>
                <PanelSection title={nl ? 'Fictief rendement' : 'Notional return'}>
                  <KeyValueRow label={<>{nl ? 'Beleggingen' : 'Investments'} <span className="opacity-50 text-[10px]">(5,88%)</span></>} value="€3.528" />
                  <KeyValueRow label={<>{nl ? 'Spaargeld'  : 'Savings'}     <span className="opacity-50 text-[10px]">(1,03%)</span></>} value="€412" />
                  <KeyValueRow label={nl ? 'Totaal rendement' : 'Total return'} value="€3.940" bold last />
                </PanelSection>
                <PanelSection title={nl ? 'Belastingberekening' : 'Tax calculation'} tint accent="#c084fc">
                  <KeyValueRow label={nl ? 'Grondslag' : 'Tax base'} value="€1.666" />
                  <KeyValueRow label={nl ? 'Tarief 36%' : 'Rate 36%'} value={`€${v2}/jr`} accent="#c084fc" last />
                </PanelSection>
              </PanelCard>
            </div>

            {/* ── 30-jaar Prognose · FIRE (with interactive chart) ── */}
            <div style={rv(calcIn, 160)} className="text-slate-200">
              <PanelCard
                accent="#fb923c"
                icon={<Flame size={15} />}
                title={nl ? '30-jaar Prognose · FIRE' : '30yr Forecast · FIRE'}
                badge={
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ borderColor: 'rgba(251,146,60,0.4)', background: 'rgba(251,146,60,0.1)', color: '#fdba74' }}>
                    {nl ? 'Hover voor jaar' : 'Hover for year'}
                  </span>
                }
                footer={
                  <ResultBar
                    label={nl ? 'Verwacht FI-jaar' : 'Expected FI year'}
                    value={v3 > 0 ? String(v3) : '—'}
                    accent="#fb923c"
                  />
                }
              >
                <StatGrid>
                  <StatTile label={nl ? 'Startkapitaal' : 'Starting capital'} value="€200k" accent="#fdba74" animateOnMount />
                  <StatTile label={`FIRE ${nl ? 'drempel' : 'target'}`}        value="€750k" accent="#fdba74" animateOnMount />
                  <StatTile label={nl ? 'Maandelijks inleggen' : 'Monthly invest'} value="€700" accent="#6ee7b7" animateOnMount />
                  <StatTile label={nl ? 'Rendement' : 'Return'} value="7%" accent="#6ee7b7" animateOnMount />
                </StatGrid>

                <PanelSection title={nl ? 'Projectie €/jr · hover voor jaartal' : 'Projection €/yr · hover for year'} tint accent="#fb923c">
                  <InteractiveAreaChart
                    points={fireSeries}
                    accent="#fb923c"
                    target={750_000}
                    targetLabel="FIRE"
                    formatY={(v) => `€${(v / 1000).toFixed(0)}k`}
                    height={130}
                    ariaLabel={nl ? '30-jaar vermogensprognose' : '30-year wealth projection'}
                  />
                </PanelSection>

                <PanelSection title={nl ? 'Parameters' : 'Parameters'}>
                  <KeyValueRow label={nl ? 'Maanduitgaven' : 'Monthly costs'} value="€2.500" />
                  <KeyValueRow label={nl ? 'Safe withdrawal rate' : 'Safe withdrawal rate'} value="4%" />
                  <KeyValueRow label={nl ? 'Verwacht vermogen 2041' : 'Projected wealth 2041'} value="€754k" accent="#fb923c" bold last />
                </PanelSection>

                <ProgressBar pct={27} accent="#fb923c" label={nl ? 'Voortgang naar FIRE' : 'Progress to FIRE'} />
              </PanelCard>
            </div>

          </div>
        </section>

        {/* ── TRUST ────────────────────────────────────────────────────────── */}
        <section className="lp2-section" ref={trustRef}>
          <div className="lp2-trust-grid">
            {[
              { Icon: Shield,    col:'#34d399', title: t.home.localTitle,    desc: t.home.localDesc,    d: 0 },
              { Icon: Zap,       col:'#60a5fa', title: t.home.liveTitle,     desc: t.home.liveDesc,     d: 80 },
              { Icon: HardDrive, col:'#f97316', title: t.home.autoSaveTitle, desc: t.home.autoSaveDesc, d: 160 },
            ].map(({ Icon, col, title, desc, d }) => (
              <div key={title} className="lp2-trust-card" style={rv(trustIn, d)}>
                <div className="lp2-trust-icon" style={{ color: col, background: `${col}18`, borderColor: `${col}25` }}>
                  <Icon size={16} />
                </div>
                <p className="lp2-trust-title">{title}</p>
                <p className="lp2-trust-desc">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── BOTTOM CTA ───────────────────────────────────────────────────── */}
        <section className="lp2-cta-section" ref={ctaRef}>
          <div className="lp2-cta-inner" style={rv(ctaIn, 0)}>
            <div className="lp2-cta-glow" aria-hidden />
            <p className="lp2-cta-pre">{nl ? '// klaar om te starten?' : '// ready to start?'}</p>
            <h2 className="lp2-cta-heading">
              {nl ? <>Klaar om de<br /><span className="lp2-cta-em">cijfers te zien?</span></> : <>Ready to see<br /><span className="lp2-cta-em">the numbers?</span></>}
            </h2>
            <p className="lp2-cta-sub">
              {nl ? 'Vul je inkomen in — resultaten verschijnen live.' : 'Enter your income — results appear live.'}
            </p>
            <button onClick={() => onOpenTab('income' as Tab)} className="lp2-cta-btn group">
              {nl ? 'Start met Inkomen' : 'Start with Income'}
              <ArrowRight size={15} className="lp2-arrow" />
            </button>
          </div>
        </section>

        <footer className="lp2-footer">
          <p>{nl ? 'Indicatieve berekening o.b.v. belastingregels 2026. Geen vervanging voor professioneel advies.' : 'Indicative calculation based on 2026 tax rules. Not a substitute for professional advice.'}</p>
        </footer>
      </div>
    </div>
  );
}
