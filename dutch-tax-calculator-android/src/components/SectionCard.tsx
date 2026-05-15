import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  icon: ReactNode;
  children: ReactNode;
  accent?: string;
}

export default function SectionCard({ title, icon, children, accent = 'border-orange-400' }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden backdrop-blur-sm">
      <div className={`flex items-center gap-3 px-6 py-4 border-b ${accent} bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-800/50 dark:via-slate-800 dark:to-slate-800/50`}>
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-900/40 dark:to-amber-900/40 text-orange-600 dark:text-orange-400 shadow-sm">
          {icon}
        </span>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
