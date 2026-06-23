import { Calculator, TrendingUp, LineChart, ShieldCheck, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function WelcomeModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const c = t.config;

  const features = [
    { icon: Calculator,  title: c.welcomeFeat1Title, desc: c.welcomeFeat1Desc, color: 'text-amber-500',   bg: 'bg-amber-500/10' },
    { icon: TrendingUp,  title: c.welcomeFeat2Title, desc: c.welcomeFeat2Desc, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { icon: LineChart,   title: c.welcomeFeat3Title, desc: c.welcomeFeat3Desc, color: 'text-sky-500',     bg: 'bg-sky-500/10' },
    { icon: ShieldCheck, title: c.welcomeFeat4Title, desc: c.welcomeFeat4Desc, color: 'text-violet-500',  bg: 'bg-violet-500/10' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header band */}
        <div className="relative bg-gradient-to-br from-amber-500 to-orange-600 px-6 py-7 sm:px-8 sm:py-8">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 bg-transparent border-0 cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight pr-8">
            {c.welcomeTitle}
          </h2>
          <p className="text-sm text-amber-50/90 mt-2 leading-relaxed max-w-xl">
            {c.welcomeIntro}
          </p>
        </div>

        {/* Features */}
        <div className="px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-4">
            {c.welcomeListTitle}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map(({ icon: Icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-700/20"
              >
                <span className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${bg} ${color}`}>
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 mt-5">{c.welcomeNote}</p>

          <button
            onClick={onClose}
            className="mt-5 w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl border-0 cursor-pointer transition-colors shadow-sm"
          >
            {c.welcomeCta}
          </button>
        </div>
      </div>
    </div>
  );
}
