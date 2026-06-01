import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  icon: ReactNode;
  children: ReactNode;
  accent?: string;
}

export default function SectionCard({ title, icon, children }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
        <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">
          {icon}
        </span>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-tight">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
