import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  icon: ReactNode;
  children: ReactNode;
  accent?: string;
}

export default function SectionCard({ title, icon, children, accent = 'border-orange-400' }: Props) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden`}>
      <div className={`flex items-center gap-3 px-6 py-4 border-b-2 ${accent} bg-gradient-to-r from-slate-50 to-white`}>
        <span className="text-orange-500">{icon}</span>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
