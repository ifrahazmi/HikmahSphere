import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  ArrowUpTrayIcon,
  BuildingLibraryIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { API_URL } from '../../config';

export type ImportDestination = 'zakat' | 'maktab';

type TransactionType = 'collection' | 'spending' | '';

interface BasePreviewRow {
  id: string;
  rowNumber: number;
  type: TransactionType;
  partyName: string;
  partyType: string;
  amount: number | '';
  paymentDate: string;
  paymentMethod: string;
  bankName: string;
  senderUpiId: string;
  chequeNumber: string;
  transactionRefId: string;
  notes: string;
  errors: string[];
  warnings: string[];
}

interface ZakatPreviewRow extends BasePreviewRow {
  purpose: 'Zakat' | 'Sadaqah' | '';
}

interface MaktabPreviewRow extends BasePreviewRow {
  contributionFrequency: 'One-time' | 'Monthly' | '';
  category: string;
  studentCount: number | '';
}

type PreviewRow = ZakatPreviewRow | MaktabPreviewRow;

const PAYMENT_METHODS = ['Bank Transfer', 'UPI Transfer', 'Cash', 'Cheque', 'QR Scanner'];
const ZAKAT_DONOR_TYPES = ['Individual', 'Organization', 'Charity'];
const ZAKAT_RECIPIENT_TYPES = ['Individual', 'Family', 'Mosque', 'Madrasa', 'NGO', 'Other'];
const MAKTAB_CONTRIBUTOR_TYPES = ['Individual', 'Organization', 'Charity'];
const MAKTAB_RECIPIENT_TYPES = ['Teacher', 'Student', 'Supplier', 'Other'];
const MAKTAB_CATEGORIES = ['Teacher Salary', 'Books/Stationery', 'Uniform', 'Rent', 'Utilities', 'Other'];

const formatINR = (value: number | '') =>
  typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : '—';

const withIds = <T extends { rowNumber: number }>(rows: T[]): Array<T & { id: string }> =>
  rows.map((row, index) => ({ ...row, id: `${row.rowNumber}-${index}-${row.rowNumber + index}` }));

const partyTypesFor = (destination: ImportDestination, type: TransactionType): string[] => {
  if (destination === 'zakat') {
    return type === 'spending' ? ZAKAT_RECIPIENT_TYPES : ZAKAT_DONOR_TYPES;
  }
  return type === 'spending' ? MAKTAB_RECIPIENT_TYPES : MAKTAB_CONTRIBUTOR_TYPES;
};

const validateRow = (destination: ImportDestination, row: PreviewRow): PreviewRow => {
  const errors: string[] = [];
  if (row.type !== 'collection' && row.type !== 'spending') {
    errors.push('Type must be Collection or Spending');
  }
  if (!String(row.partyName || '').trim()) {
    errors.push('Party name is required');
  }
  if (typeof row.amount !== 'number' || row.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }
  if (!row.paymentDate) {
    errors.push('Payment date is required');
  }
  if (row.paymentMethod === 'UPI Transfer' && !String(row.senderUpiId || '').trim()) {
    errors.push('Sender UPI ID is required for UPI Transfer');
  }
  if (destination === 'zakat' && !(row as ZakatPreviewRow).purpose) {
    errors.push('Purpose is required');
  }
  return { ...row, errors };
};

interface FundsImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (destination: ImportDestination, inserted: number) => void;
}

const FundsImportModal: React.FC<FundsImportModalProps> = ({ open, onClose, onImported }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [destination, setDestination] = useState<ImportDestination | null>(null);
  const [step, setStep] = useState<'choose' | 'preview'>('choose');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileError, setFileError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PreviewRow | null>(null);

  const resetState = () => {
    setDestination(null);
    setStep('choose');
    setFileName('');
    setRows([]);
    setFileError('');
    setPreviewing(false);
    setConfirming(false);
    setDragOver(false);
    setEditingId(null);
    setEditDraft(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setDestination(null);
    setStep('choose');
    setFileName('');
    setRows([]);
    setFileError('');
    setPreviewing(false);
    setConfirming(false);
    setDragOver(false);
    setEditingId(null);
    setEditDraft(null);
  }, [open]);

  const handleClose = () => {
    if (previewing || confirming) return;
    resetState();
    onClose();
  };

  const validCount = useMemo(() => rows.filter((row) => row.errors.length === 0).length, [rows]);
  const errorCount = rows.length - validCount;
  const warningCount = rows.filter((row) => row.warnings.length > 0).length;
  const canConfirm = rows.length > 0 && errorCount === 0 && !confirming && !editingId;
  const destinationLabel = destination === 'maktab' ? 'Maktab' : 'Zakat & Sadaqah';

  const uploadForPreview = async (file: File) => {
    if (!destination) {
      setFileError('Choose Zakat & Sadaqah or Maktab first.');
      return;
    }
    setFileError('');
    setPreviewing(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_URL}/${destination}/import/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Could not read this file');
      }
      setFileName(data.data.fileName || file.name);
      setRows(withIds(data.data.rows || []));
      setStep('preview');
      setEditingId(null);
      setEditDraft(null);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Could not read this file');
      setRows([]);
      setStep('choose');
    } finally {
      setPreviewing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFile = (file?: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.json') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setFileError('Please upload a CSV or JSON file.');
      return;
    }
    void uploadForPreview(file);
  };

  const startEdit = (row: PreviewRow) => {
    setEditingId(row.id);
    setEditDraft({ ...row });
  };

  const saveEdit = () => {
    if (!editDraft || !destination) return;
    const next = validateRow(destination, editDraft);
    setRows((prev) => prev.map((row) => (row.id === next.id ? next : row)));
    setEditingId(null);
    setEditDraft(null);
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditDraft(null);
    }
  };

  const handleConfirm = async () => {
    if (!destination || !canConfirm) return;
    const label = destination === 'maktab' ? 'Maktab' : 'Zakat & Sadaqah';
    if (!window.confirm(`Import ${rows.length} transaction${rows.length === 1 ? '' : 's'} into ${label}? This will save them to the database.`)) {
      return;
    }
    setConfirming(true);
    try {
      const token = localStorage.getItem('token');
      const payloadRows = rows.map(({ id, ...row }) => row);
      const response = await fetch(`${API_URL}/${destination}/import/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rows: payloadRows }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Import failed');
      }
      const inserted = data.data?.inserted ?? rows.length;
      toast.success(`Imported ${inserted} ${label} transaction${inserted === 1 ? '' : 's'}`);
      onImported(destination, inserted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setConfirming(false);
    }
  };

  if (!open) return null;

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  const renderEditForm = (draft: PreviewRow) => {
    const types = partyTypesFor(destination || 'zakat', draft.type);
    const isMaktab = destination === 'maktab';
    const maktabDraft = draft as MaktabPreviewRow;
    const zakatDraft = draft as ZakatPreviewRow;
    const update = (patch: Partial<PreviewRow>) => setEditDraft({ ...draft, ...patch } as PreviewRow);

    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-medium text-gray-600">
            Type
            <select
              className={`${inputClass} mt-1`}
              value={draft.type}
              onChange={(e) => {
                const type = e.target.value as TransactionType;
                const nextTypes = partyTypesFor(destination || 'zakat', type);
                update({
                  type,
                  partyType: nextTypes.includes(draft.partyType) ? draft.partyType : nextTypes[0],
                });
              }}
            >
              <option value="collection">Collection</option>
              <option value="spending">Spending</option>
            </select>
          </label>
          {!isMaktab ? (
            <label className="text-xs font-medium text-gray-600">
              Purpose
              <select
                className={`${inputClass} mt-1`}
                value={zakatDraft.purpose || 'Zakat'}
                onChange={(e) => update({ purpose: e.target.value as 'Zakat' | 'Sadaqah' } as Partial<ZakatPreviewRow>)}
              >
                <option value="Zakat">Zakat</option>
                <option value="Sadaqah">Sadaqah</option>
              </select>
            </label>
          ) : draft.type === 'spending' ? (
            <label className="text-xs font-medium text-gray-600">
              Category
              <select
                className={`${inputClass} mt-1`}
                value={maktabDraft.category || 'Other'}
                onChange={(e) => update({ category: e.target.value } as Partial<MaktabPreviewRow>)}
              >
                {MAKTAB_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-xs font-medium text-gray-600">
              Frequency
              <select
                className={`${inputClass} mt-1`}
                value={maktabDraft.contributionFrequency || 'One-time'}
                onChange={(e) => update({ contributionFrequency: e.target.value as 'One-time' | 'Monthly' } as Partial<MaktabPreviewRow>)}
              >
                <option value="One-time">One-time</option>
                <option value="Monthly">Monthly</option>
              </select>
            </label>
          )}
          <label className="text-xs font-medium text-gray-600 sm:col-span-2">
            Party name
            <input className={`${inputClass} mt-1`} value={draft.partyName} onChange={(e) => update({ partyName: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Party type
            <select className={`${inputClass} mt-1`} value={draft.partyType} onChange={(e) => update({ partyType: e.target.value })}>
              {types.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            Amount
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={`${inputClass} mt-1`}
              value={draft.amount}
              onChange={(e) => update({ amount: e.target.value === '' ? '' : Number(e.target.value) })}
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Date
            <input type="date" className={`${inputClass} mt-1`} value={draft.paymentDate} onChange={(e) => update({ paymentDate: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Method
            <select className={`${inputClass} mt-1`} value={draft.paymentMethod} onChange={(e) => update({ paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </label>
          {isMaktab && draft.type === 'spending' && (
            <label className="text-xs font-medium text-gray-600">
              Students supported
              <input
                type="number"
                min="0"
                className={`${inputClass} mt-1`}
                value={maktabDraft.studentCount}
                onChange={(e) => update({ studentCount: e.target.value === '' ? '' : Number(e.target.value) } as Partial<MaktabPreviewRow>)}
              />
            </label>
          )}
          <label className="text-xs font-medium text-gray-600">
            Bank name
            <input className={`${inputClass} mt-1`} value={draft.bankName} onChange={(e) => update({ bankName: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            UPI ID
            <input className={`${inputClass} mt-1`} value={draft.senderUpiId} onChange={(e) => update({ senderUpiId: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Cheque number
            <input className={`${inputClass} mt-1`} value={draft.chequeNumber} onChange={(e) => update({ chequeNumber: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Reference ID
            <input className={`${inputClass} mt-1`} value={draft.transactionRefId} onChange={(e) => update({ transactionRefId: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-gray-600 sm:col-span-2">
            Notes
            <textarea className={`${inputClass} mt-1`} rows={2} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => { setEditingId(null); setEditDraft(null); }} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={saveEdit} className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            Save row
          </button>
        </div>
      </div>
    );
  };

  const renderRowMeta = (row: PreviewRow) => {
    if (destination === 'maktab') {
      const maktab = row as MaktabPreviewRow;
      return row.type === 'spending' ? (maktab.category || 'Other') : (maktab.contributionFrequency || 'One-time');
    }
    return (row as ZakatPreviewRow).purpose || 'Zakat';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-labelledby="funds-import-title"
        className="relative flex h-[100dvh] sm:h-auto sm:max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
          <div>
            <h3 id="funds-import-title" className="text-xl font-bold text-gray-900">Import transactions</h3>
            <p className="mt-1 text-sm text-gray-500">
              {step === 'choose'
                ? 'Choose the fund type, then upload a CSV or JSON file. Nothing is saved until you confirm.'
                : `${fileName} · ${destinationLabel}`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close import"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          {step === 'choose' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setDestination('zakat'); setFileError(''); }}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    destination === 'zakat'
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                      : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                  }`}
                >
                  <BuildingLibraryIcon className="h-8 w-8 text-emerald-600 mb-2" />
                  <p className="font-semibold text-gray-900">Zakat &amp; Sadaqah</p>
                  <p className="text-sm text-gray-500 mt-1">Collections and spending for Zakat or Sadaqah.</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setDestination('maktab'); setFileError(''); }}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    destination === 'maktab'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                >
                  <AcademicCapIcon className="h-8 w-8 text-indigo-600 mb-2" />
                  <p className="font-semibold text-gray-900">Maktab</p>
                  <p className="text-sm text-gray-500 mt-1">Contributions and education expenses.</p>
                </button>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); if (destination) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
                className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
                  !destination
                    ? 'border-gray-200 bg-gray-50 text-gray-400'
                    : dragOver
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-300 bg-white hover:border-emerald-400'
                }`}
              >
                <ArrowUpTrayIcon className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-3 font-medium text-gray-800">
                  {destination ? 'Drop CSV or JSON here' : 'Select a fund type first'}
                </p>
                <p className="text-sm text-gray-500 mt-1">CSV or JSON from Export. Excel files are also accepted.</p>
                <button
                  type="button"
                  disabled={!destination || previewing}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {previewing ? 'Reading file...' : 'Choose file'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,.xlsx,.xls,text/csv,application/json"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>

              {fileError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                  <p>{fileError}</p>
                </div>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">{rows.length} rows</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">{validCount} valid</span>
                {errorCount > 0 && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">{errorCount} with errors</span>
                )}
                {warningCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{warningCount} with warnings</span>
                )}
              </div>
              {errorCount > 0 && (
                <p className="text-sm text-red-700">Fix or remove rows with errors before importing.</p>
              )}

              <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">{destination === 'maktab' ? 'Category' : 'Purpose'}</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Party</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row) => (
                      <React.Fragment key={row.id}>
                        <tr className={row.errors.length ? 'bg-red-50/70' : row.warnings.length ? 'bg-amber-50/40' : ''}>
                          <td className="px-3 py-2 whitespace-nowrap">{row.paymentDate || '—'}</td>
                          <td className="px-3 py-2 capitalize">{row.type || '—'}</td>
                          <td className="px-3 py-2">{renderRowMeta(row)}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-900">{row.partyName || '—'}</p>
                            <p className="text-xs text-gray-500">{row.partyType}</p>
                          </td>
                          <td className={`px-3 py-2 text-right font-semibold ${row.type === 'spending' ? 'text-red-600' : 'text-green-700'}`}>
                            {row.type === 'spending' ? '−' : '+'}{formatINR(row.amount)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => startEdit(row)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Edit">
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => deleteRow(row.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Remove from import">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                        {(row.errors.length > 0 || row.warnings.length > 0) && editingId !== row.id && (
                          <tr className={row.errors.length ? 'bg-red-50/70' : 'bg-amber-50/40'}>
                            <td colSpan={6} className="px-3 pb-2 text-xs">
                              {row.errors.map((msg) => <p key={msg} className="text-red-700">{msg}</p>)}
                              {row.warnings.map((msg) => <p key={msg} className="text-amber-700">{msg}</p>)}
                            </td>
                          </tr>
                        )}
                        {editingId === row.id && editDraft && (
                          <tr>
                            <td colSpan={6} className="p-3">{renderEditForm(editDraft)}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={`rounded-xl border p-3 ${
                      row.errors.length ? 'border-red-200 bg-red-50' : row.warnings.length ? 'border-amber-200 bg-amber-50/60' : 'border-gray-200 bg-white'
                    }`}
                  >
                    {editingId === row.id && editDraft ? (
                      renderEditForm(editDraft)
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs text-gray-500">{row.paymentDate} · {row.type || 'Unknown'}</p>
                            <p className="font-semibold text-gray-900">{row.partyName || 'Missing party'}</p>
                            <p className="text-xs text-gray-500">{row.partyType} · {renderRowMeta(row)}</p>
                          </div>
                          <p className={`font-bold ${row.type === 'spending' ? 'text-red-600' : 'text-green-700'}`}>
                            {row.type === 'spending' ? '−' : '+'}{formatINR(row.amount)}
                          </p>
                        </div>
                        {row.errors.map((msg) => <p key={msg} className="mt-2 text-xs text-red-700">{msg}</p>)}
                        {row.warnings.map((msg) => <p key={msg} className="mt-1 text-xs text-amber-700">{msg}</p>)}
                        <div className="mt-3 flex justify-end gap-2">
                          <button type="button" onClick={() => startEdit(row)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700">
                            <PencilIcon className="h-4 w-4" /> Edit
                          </button>
                          <button type="button" onClick={() => deleteRow(row.id)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">
                            <TrashIcon className="h-4 w-4" /> Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => {
              if (step === 'preview') {
                setStep('choose');
                setRows([]);
                setFileName('');
                setEditingId(null);
                setEditDraft(null);
                return;
              }
              handleClose();
            }}
            disabled={previewing || confirming}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {step === 'preview' ? <><ArrowLeftIcon className="h-4 w-4" /> Back</> : 'Cancel'}
          </button>
          {step === 'preview' && (
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!canConfirm}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirming ? 'Importing...' : `Confirm import (${validCount})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FundsImportModal;
