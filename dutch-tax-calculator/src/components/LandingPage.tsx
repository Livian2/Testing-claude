import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, X, Flag, Shield, Zap, HardDrive } from 'lucide-react';

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
    const id = setTimeout(() => { setShownIdx(activeIdx); setCycleKey(k => k + 1); setSpotOpacity(1); pillRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 170);
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
            {/* Box 1 */}
            <div className="lp2-calc-card" style={rv(calcIn, 0)}>
              <div className="lp2-calc-tag" style={{ color:'#60a5fa', background:'rgba(96,165,250,0.1)', borderColor:'rgba(96,165,250,0.2)' }}>
                Box 1 — {nl ? 'Inkomen' : 'Income'}
              </div>
              <div className="lp2-calc-rows">
                <div className="lp2-calc-row"><span>{nl ? 'Bruto salaris' : 'Gross salary'}</span><span>€60.000</span></div>
                <div className="lp2-calc-row lp2-calc-dim"><span>− {nl ? 'Schijf 1 (35,82%)' : 'Bracket 1 (35.82%)'}</span><span>€13.769</span></div>
                <div className="lp2-calc-row lp2-calc-dim"><span>− {nl ? 'Schijf 2 (37,48%)' : 'Bracket 2 (37.48%)'}</span><span>€8.081</span></div>
                <div className="lp2-calc-row lp2-calc-dim"><span>− {nl ? 'Heffingskortingen' : 'Tax credits'}</span><span>€5.925</span></div>
              </div>
              <div className="lp2-calc-result">
                <span className="lp2-calc-rlbl">{nl ? 'Netto maandinkomen' : 'Net monthly income'}</span>
                <span className="lp2-calc-big" style={{ color:'#60a5fa' }}>€{v1.toLocaleString('nl-NL')}<small>/mnd</small></span>
              </div>
            </div>

            {/* Box 3 */}
            <div className="lp2-calc-card" style={rv(calcIn, 80)}>
              <div className="lp2-calc-tag" style={{ color:'#c084fc', background:'rgba(192,132,252,0.1)', borderColor:'rgba(192,132,252,0.2)' }}>
                Box 3 — {nl ? 'Vermogen' : 'Wealth'}
              </div>
              <div className="lp2-calc-rows">
                <div className="lp2-calc-row"><span>{nl ? 'Beleggingen (5,88%)' : 'Investments (5.88%)'}</span><span>€60.000</span></div>
                <div className="lp2-calc-row"><span>{nl ? 'Spaargeld (1,03%)' : 'Savings (1.03%)'}</span><span>€40.000</span></div>
                <div className="lp2-calc-row lp2-calc-dim"><span>− {nl ? 'Vrijstelling' : 'Exemption'}</span><span>€57.684</span></div>
                <div className="lp2-calc-row lp2-calc-dim"><span>{nl ? 'Tarief 36%' : 'Rate 36%'}</span><span>→</span></div>
              </div>
              <div className="lp2-calc-result">
                <span className="lp2-calc-rlbl">{nl ? 'Box 3 belasting' : 'Box 3 tax'}</span>
                <span className="lp2-calc-big" style={{ color:'#c084fc' }}>€{v2}<small>/jr</small></span>
              </div>
            </div>

            {/* FIRE */}
            <div className="lp2-calc-card" style={rv(calcIn, 160)}>
              <div className="lp2-calc-tag" style={{ color:'#fb923c', background:'rgba(251,146,60,0.1)', borderColor:'rgba(251,146,60,0.2)' }}>
                {nl ? '30-jaar Prognose · FIRE' : '30yr Forecast · FIRE'}
              </div>
              <div className="lp2-calc-rows">
                <div className="lp2-calc-row"><span>{nl ? 'Huidig vermogen' : 'Current wealth'}</span><span>€200.000</span></div>
                <div className="lp2-calc-row"><span>{nl ? 'Maandelijkse inleg' : 'Monthly invest'}</span><span>€700</span></div>
                <div className="lp2-calc-row"><span>{nl ? 'Maanduitgaven' : 'Monthly expenses'}</span><span>€2.500</span></div>
                <div className="lp2-calc-row"><span>{nl ? 'Rendement' : 'Return'}</span><span>7%</span></div>
                <div className="lp2-calc-row lp2-calc-dim"><span>{nl ? 'FIRE-drempel (4% SWR)' : 'FIRE target (4% SWR)'}</span><span>€750k</span></div>
              </div>
              <div className="lp2-calc-result">
                <span className="lp2-calc-rlbl">{nl ? 'Verwacht FI-jaar' : 'Expected FI year'}</span>
                <span className="lp2-calc-big" style={{ color:'#fb923c' }}>{v3 > 0 ? v3 : '—'}</span>
              </div>
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
