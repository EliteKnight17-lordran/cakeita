import type { ReactNode } from 'react';
import { formatPeso } from '../domain/money';
import { IconAlert, IconCheck, IconInfo, IconStop } from './icons';

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'danger' | 'ok'; title?: string; children?: ReactNode }) {
  const cls = {
    info: 'border-line bg-white text-ink',
    warn: 'border-[#e6cf9c] bg-amber-bg text-amber-ink',
    danger: 'border-[#e8b4ad] bg-danger-bg text-danger-ink',
    ok: 'border-[#b9d6be] bg-ok-bg text-ok-ink',
  }[tone];
  const Icon = { info: IconInfo, warn: IconAlert, danger: IconStop, ok: IconCheck }[tone];
  return (
    <div className={`rounded-xl border p-3.5 ${cls}`} role={tone === 'danger' ? 'alert' : undefined}>
      <div className="flex gap-2.5">
        <Icon size={20} className={`mt-0.5 shrink-0 ${tone === 'info' ? 'text-berry' : ''}`} />
        <div className="min-w-0">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className="text-[0.95rem]">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function Chip({ pressed, onClick, children, label }: { pressed: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} aria-label={label} onClick={onClick}>
      {pressed && <IconCheck size={15} className="-ml-1" />}
      {children}
    </button>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Peso({ value, className = '' }: { value: number; className?: string }) {
  return <span className={className}>{formatPeso(value)}</span>;
}

export function SampleBadge({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return <span className="tag bg-amber-bg text-amber-ink">{text}</span>;
}

export function Stepper({ step, total, label }: { step: number; total: number; label: string }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="mb-4" aria-label={label}>
      <div className="mb-1 flex justify-between text-sm font-semibold text-ink-soft">
        <span>{label}</span>
        <span>
          {step}/{total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-berry-soft" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={step}>
        <div className="h-full rounded-full bg-berry transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Bubble({ from, children }: { from: 'app' | 'me'; children: ReactNode }) {
  return (
    <div className={`flex ${from === 'me' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-base ${from === 'me' ? 'rounded-br-sm bg-berry text-white' : 'rounded-bl-sm border border-line bg-white text-ink'}`}>{children}</div>
    </div>
  );
}
