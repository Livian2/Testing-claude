import { useEffect, useRef, useState } from 'react';
import { HelpCircle, ArrowRight, Shield, Zap, HardDrive, ChevronRight } from 'lucide-react';

type Tab = string;

interface TabMeta {
  id: Tab;
  emoji: string;
  description: string;
}

interface HomePageProps {
  ALL_TABS: TabMeta[];
  TAB_LABELS: Record<Tab, string>;
  enabledTabs: Set<Tab>;
  visibleTabs: TabMeta[];
  toggleTab: (id: Tab) => void;
  setTab: (id: Tab | 'home') => void;
  t: {
    home: {
      taxYear: string;
      welcome: string;
      subtitle: string;
      viewGuide: string;
      yourTabs: string;
      toggleHint: string;
      active: string;
      openTab: string;
      localTitle: string;
      localDesc: string;
      liveTitle: string;
      liveDesc: string;
      autoSaveTitle: string;
      autoSaveDesc: string;
    };
  };
  setShowWelcome: (v: boolean) => void;
}

function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    setValue(0);
    let startTs: number | null = null;
    let raf: number;
    const tick = (ts: number) => {
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return value;
}

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

export default function HomePage({
  ALL_TABS, TAB_LABELS, enabledTabs, visibleTabs, toggleTab, setTab, t, setShowWelcome,
}: HomePageProps) {
  const [heroReady, setHeroReady] = useState(false);
  const [featRef, featInView] = useInView();
  const [modsRef, modsInView] = useInView(0.04);

  const moduleCount = useCountUp(ALL_TABS.length, 900, heroReady);

  useEffect(() => {
    const id = setTimeout(() => setHeroReady(true), 60);
    return () => clearTimeout(id);
  }, []);

  const features = [
    { icon: <Shield size={17} />, colorClass: 'feat-emerald', title: t.home.localTitle, desc: t.home.localDesc },
    { icon: <Zap size={17} />,    colorClass: 'feat-blue',    title: t.home.liveTitle,  desc: t.home.liveDesc },
    { icon: <HardDrive size={17} />, colorClass: 'feat-violet', title: t.home.autoSaveTitle, desc: t.home.autoSaveDesc },
  ];

  return (
    <div className="hp-root">

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="hp-hero">
        <div className="hp-hero-grid" aria-hidden />
        <div className="hp-hero-glow-top" aria-hidden />
        <div className="hp-hero-glow-bottom" aria-hidden />
        <div className="shimmer-sweep" aria-hidden />

        {/* Large NL watermark */}
        <div className="hp-hero-watermark" aria-hidden>NL</div>

        <div className="hp-hero-inner">
          {/* ── Badge ── */}
          <div
            className="hp-hero-badge"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 500ms cubic-bezier(0.22,1,0.36,1), transform 500ms cubic-bezier(0.22,1,0.36,1)',
              transitionDelay: '0ms',
            }}
          >
            <span className="hp-badge-dot" />
            {t.home.taxYear}
          </div>

          {/* ── Headline ── */}
          <h1
            className="hp-hero-headline"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? 'translateY(0)' : 'translateY(14px)',
              filter: heroReady ? 'blur(0px)' : 'blur(4px)',
              transition: 'opacity 600ms cubic-bezier(0.22,1,0.36,1), transform 600ms cubic-bezier(0.22,1,0.36,1), filter 600ms cubic-bezier(0.22,1,0.36,1)',
              transitionDelay: '80ms',
            }}
          >
            <span className="hp-headline-plain">NL Belasting</span>
            <span className="hp-headline-accent">Calculator</span>
          </h1>

          {/* ── Subtitle ── */}
          <p
            className="hp-hero-sub"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? 'translateY(0)' : 'translateY(10px)',
              filter: heroReady ? 'blur(0px)' : 'blur(3px)',
              transition: 'opacity 600ms cubic-bezier(0.22,1,0.36,1), transform 600ms cubic-bezier(0.22,1,0.36,1), filter 600ms cubic-bezier(0.22,1,0.36,1)',
              transitionDelay: '160ms',
            }}
          >
            {t.home.subtitle}
          </p>

          {/* ── Stats ── */}
          <div
            className="hp-stats"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 600ms cubic-bezier(0.22,1,0.36,1), transform 600ms cubic-bezier(0.22,1,0.36,1)',
              transitionDelay: '240ms',
            }}
          >
            <StatPill value="2026" label="Belastingjaar" />
            <StatPill value={`${moduleCount}`} label="Modules" />
            <StatPill value="0" label="Server calls" />
          </div>

          {/* ── CTAs ── */}
          <div
            className="hp-ctas"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 600ms cubic-bezier(0.22,1,0.36,1), transform 600ms cubic-bezier(0.22,1,0.36,1)',
              transitionDelay: '320ms',
            }}
          >
            <button
              onClick={() => setTab('income')}
              className="hp-cta-primary"
            >
              Open Calculator
              <ArrowRight size={15} className="hp-cta-arrow" />
            </button>
            <button
              onClick={() => setShowWelcome(true)}
              className="hp-cta-ghost"
            >
              <HelpCircle size={15} />
              {t.home.viewGuide}
            </button>
          </div>
        </div>

        {/* Fade into page */}
        <div className="hp-hero-fade" aria-hidden />
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FEATURES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div ref={featRef} className="hp-features-wrap">
        <div className="hp-features-grid">
          {features.map((f, i) => (
            <div
              key={i}
              className="hp-feat-card"
              style={{
                opacity: featInView ? 1 : 0,
                transform: featInView ? 'translateY(0)' : 'translateY(18px)',
                filter: featInView ? 'blur(0px)' : 'blur(3px)',
                transition: 'opacity 500ms cubic-bezier(0.22,1,0.36,1), transform 500ms cubic-bezier(0.22,1,0.36,1), filter 500ms cubic-bezier(0.22,1,0.36,1)',
                transitionDelay: `${i * 80}ms`,
              }}
            >
              <div className={`hp-feat-icon ${f.colorClass}`}>{f.icon}</div>
              <div>
                <p className="hp-feat-title">{f.title}</p>
                <p className="hp-feat-desc">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ MODULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div ref={modsRef} className="hp-mods-wrap">

        {/* Section header */}
        <div
          className="hp-mods-header"
          style={{
            opacity: modsInView ? 1 : 0,
            transform: modsInView ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 500ms cubic-bezier(0.22,1,0.36,1), transform 500ms cubic-bezier(0.22,1,0.36,1)',
            transitionDelay: '0ms',
          }}
        >
          <div>
            <h2 className="hp-mods-title">{t.home.yourTabs}</h2>
            <p className="hp-mods-hint">{t.home.toggleHint}</p>
          </div>
          <span className="hp-mods-count">
            {visibleTabs.length} / {ALL_TABS.length} {t.home.active}
          </span>
        </div>

        {/* Card grid */}
        <div className="hp-cards-grid">
          {ALL_TABS.map((tabMeta, index) => {
            const enabled = enabledTabs.has(tabMeta.id);
            return (
              <div
                key={tabMeta.id}
                className={`hp-card home-tab-card ${enabled ? 'hp-card-on card-enabled' : 'hp-card-off'}`}
                style={{
                  opacity: modsInView ? (enabled ? 1 : 0.5) : 0,
                  transform: modsInView ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
                  filter: modsInView ? 'blur(0px)' : 'blur(4px)',
                  transition: 'opacity 400ms cubic-bezier(0.22,1,0.36,1), transform 400ms cubic-bezier(0.22,1,0.36,1), filter 400ms cubic-bezier(0.22,1,0.36,1)',
                  transitionDelay: `${Math.min(index * 38, 420)}ms`,
                }}
              >
                {enabled && <div className="hp-card-topline" />}

                {/* Header row */}
                <div className="hp-card-head">
                  <div className="hp-card-label">
                    <span className="hp-card-emoji">{tabMeta.emoji}</span>
                    <span className="hp-card-name">{TAB_LABELS[tabMeta.id]}</span>
                  </div>
                  <button
                    onClick={() => toggleTab(tabMeta.id)}
                    className={`hp-toggle ${enabled ? 'hp-toggle-on' : 'hp-toggle-off'}`}
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`Toggle ${TAB_LABELS[tabMeta.id]}`}
                  >
                    <span className={`hp-toggle-thumb ${enabled ? 'hp-toggle-thumb-on' : 'hp-toggle-thumb-off'}`} />
                  </button>
                </div>

                {/* Description */}
                <p className="hp-card-desc">{tabMeta.description}</p>

                {/* Open link */}
                {enabled && (
                  <button
                    onClick={() => setTab(tabMeta.id)}
                    className="hp-card-open group/open"
                  >
                    {t.home.openTab} {TAB_LABELS[tabMeta.id]}
                    <ChevronRight size={12} className="hp-card-open-arrow" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FOOTER NOTE ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div
        className="hp-footer-note"
        style={{
          opacity: modsInView ? 1 : 0,
          transition: 'opacity 600ms cubic-bezier(0.22,1,0.36,1)',
          transitionDelay: '520ms',
        }}
      >
        Indicatieve berekening o.b.v. belastingregels 2026. Raadpleeg altijd een belastingadviseur voor persoonlijk advies.
      </div>
    </div>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="hp-stat-pill">
      <span className="hp-stat-value">{value}</span>
      <span className="hp-stat-label">{label}</span>
    </div>
  );
}
