import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

type TransactionViewPanelProps = {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
};

type DetailTileProps = {
  label: string;
  children?: React.ReactNode;
  full?: boolean;
  mono?: boolean;
};

export const TransactionAmountHeader: React.FC<{
  tone: 'in' | 'out';
  label: string;
  amount: string;
}> = ({ tone, label, amount }) => (
  <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2.5">
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
        tone === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }`}
    >
      {label}
    </span>
    <span className="min-w-0 break-words text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">
      {amount}
    </span>
  </div>
);

export const DetailGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</div>
);

export const DetailTile: React.FC<DetailTileProps> = ({ label, children, full, mono }) => {
  if (children === undefined || children === null || children === '') return null;

  return (
    <div className={`min-w-0 rounded-xl bg-slate-50 px-3.5 py-3 ${full ? 'sm:col-span-2' : ''}`}>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div
        className={`mt-1 text-sm sm:text-[0.95rem] font-medium text-slate-900 break-words whitespace-pre-wrap [overflow-wrap:anywhere] ${
          mono ? 'font-mono text-[0.8rem] sm:text-sm tracking-wide' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export const TransactionViewPanel: React.FC<TransactionViewPanelProps> = ({
  title = 'Transaction Details',
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-900/50 p-0 sm:items-center sm:p-4"
    onClick={onClose}
  >
    <div
      className="flex w-full min-w-0 max-w-xl max-h-[94dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:my-4 sm:rounded-2xl"
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-view-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <h3 id="transaction-view-title" className="min-w-0 truncate text-lg font-bold text-slate-900 sm:text-xl">
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close transaction details"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5">
        {children}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:rounded-b-2xl sm:px-5">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-slate-200 px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-300"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

export default TransactionViewPanel;
