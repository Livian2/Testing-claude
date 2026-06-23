import { useState } from 'react';
import { Bug, Lightbulb, MessageSquarePlus, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

type Status = 'idle' | 'sending' | 'sent' | 'error';
type FeedbackType = 'bug' | 'feature';

export default function BugReportWidget({ appVersion }: { appVersion: string }) {
  const { t } = useLanguage();
  const [open, setOpen]       = useState(false);
  const [type, setType]       = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail]     = useState('');
  const [status, setStatus]   = useState<Status>('idle');
  const [error, setError]     = useState('');

  const reset = () => {
    setOpen(false);
    setType('bug');
    setMessage('');
    setEmail('');
    setStatus('idle');
    setError('');
  };

  const submit = async () => {
    if (!message.trim()) {
      setError(t.bugReport.errorEmpty);
      return;
    }
    setError('');
    setStatus('sending');
    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message,
          email,
          page: window.location.pathname + window.location.hash,
          userAgent: navigator.userAgent,
          appVersion,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('sent');
    } catch {
      setStatus('error');
      setError(t.bugReport.errorGeneric);
    }
  };

  const isBug = type === 'bug';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t.bugReport.button}
        className="fixed bottom-5 right-5 z-30 flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-full border-0 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/30 hover:shadow-amber-600/40 hover:-translate-y-0.5 cursor-pointer transition-all"
      >
        <MessageSquarePlus size={15} />
        <span className="hidden sm:inline">{t.bugReport.button}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
          onClick={reset}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <MessageSquarePlus size={15} /> {t.bugReport.title}
              </h3>
              <button onClick={reset} className="p-1 text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer">
                <X size={15} />
              </button>
            </div>

            {status === 'sent' ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 py-3">{t.bugReport.success}</p>
            ) : (
              <>
                {/* Type toggle */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-700/50 mb-3">
                  {([
                    { id: 'bug' as const,     icon: Bug,       label: t.bugReport.typeBug },
                    { id: 'feature' as const, icon: Lightbulb, label: t.bugReport.typeFeature },
                  ]).map(({ id, icon: Icon, label }) => {
                    const sel = type === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setType(id)}
                        className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md border-0 cursor-pointer transition-colors ${
                          sel
                            ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                            : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        <Icon size={13} /> {label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                  {isBug ? t.bugReport.descriptionBug : t.bugReport.descriptionFeature}
                </p>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={isBug ? t.bugReport.placeholderBug : t.bugReport.placeholderFeature}
                  rows={4}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
                <label className="block text-xs text-slate-500 dark:text-slate-400 mt-3 mb-1">{t.bugReport.emailLabel}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t.bugReport.emailPlaceholder}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-400"
                />
                {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={reset} className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-transparent border-0 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                    {t.bugReport.cancel}
                  </button>
                  <button
                    onClick={submit}
                    disabled={status === 'sending'}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 rounded-lg border-0 cursor-pointer"
                  >
                    {status === 'sending' ? t.bugReport.sending : t.bugReport.submit}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
