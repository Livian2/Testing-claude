import { Calculator, TrendingUp, LineChart, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function LandingPage({ onStart, onCalc }: { onStart: () => void; onCalc: () => void }) {
  const { t } = useLanguage();
  const c = t.config;

  const features = [
    { icon: Calculator,  title: c.welcomeFeat1Title, desc: c.welcomeFeat1Desc, color: 'text-amber-500',   bg: 'bg-amber-500/10' },
    { icon: TrendingUp,  title: c.welcomeFeat2Title, desc: c.welcomeFeat2Desc, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { icon: LineChart,   title: c.welcomeFeat3Title, desc: c.welcomeFeat3Desc, color: 'text-sky-500',     bg: 'bg-sky-500/10' },
    { icon: ShieldCheck, title: c.welcomeFeat4Title, desc: c.welcomeFeat4Desc, color: 'text-violet-500',  bg: 'bg-violet-500/10' },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Soft background glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-32 flex justify-center" aria-hidden>
        <div className="h-72 w-[42rem] max-w-full rounded-full bg-gradient-to-br from-amber-400/20 via-orange-400/10 to-transparent blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Sparkles size={13} /> {c.welcomeBadge}
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-slate-800 dark:text-slate-50 leading-tight">
            {c.welcomeTitle}
          </h1>
          <p className="mt-4 text-base text-slate-500 dark:text-slate-400 leading-relaxed">
            {c.welcomeIntro}
          </p>

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onStart}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl border-0 cursor-pointer shadow-lg shadow-amber-600/25 hover:-translate-y-0.5 transition-all"
            >
              {c.welcomeCta} <ArrowRight size={16} />
            </button>
            <button
              onClick={onCalc}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:border-amber-400 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
            >
              {c.welcomeStartCalc}
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 sm:mt-16">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-5">
            {c.welcomeListTitle}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {features.map(({ icon: Icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${bg} ${color} mb-3`}>
                  <Icon size={20} />
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400 dark:text-slate-500">{c.welcomeNote}</p>
      </div>
    </div>
  );
}
