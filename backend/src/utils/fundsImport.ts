import * as XLSX from 'xlsx';

export const MAX_IMPORT_ROWS = 500;

export const VALID_METHODS = ['Bank Transfer', 'UPI Transfer', 'Cash', 'Cheque', 'QR Scanner'] as const;
export type PaymentMethod = (typeof VALID_METHODS)[number];

export const ZAKAT_DONOR_TYPES = ['Individual', 'Organization', 'Charity'] as const;
export const ZAKAT_RECIPIENT_TYPES = ['Individual', 'Family', 'Mosque', 'Madrasa', 'NGO', 'Other'] as const;
export const MAKTAB_CONTRIBUTOR_TYPES = ['Individual', 'Organization', 'Charity'] as const;
export const MAKTAB_RECIPIENT_TYPES = ['Teacher', 'Student', 'Supplier', 'Other'] as const;
export const MAKTAB_SPENDING_CATEGORIES = [
  'Teacher Salary',
  'Books/Stationery',
  'Uniform',
  'Rent',
  'Utilities',
  'Other',
] as const;

export type TransactionType = 'collection' | 'spending';
export type ZakatPurpose = 'Zakat' | 'Sadaqah';

export interface ZakatPreviewRow {
  rowNumber: number;
  type: TransactionType | '';
  purpose: ZakatPurpose | '';
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

export interface MaktabPreviewRow {
  rowNumber: number;
  type: TransactionType | '';
  partyName: string;
  partyType: string;
  contributionFrequency: 'One-time' | 'Monthly' | '';
  category: string;
  studentCount: number | '';
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

export const parseImportRows = (file: { originalname?: string; mimetype?: string; buffer: Buffer }): any[] => {
  const name = (file.originalname || '').toLowerCase();
  const buf = file.buffer;

  if (name.endsWith('.json') || file.mimetype === 'application/json') {
    const parsed = JSON.parse(buf.toString('utf-8'));
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    return [];
  }

  const isCsv = name.endsWith('.csv') || file.mimetype === 'text/csv';
  // Keep CSV values as strings. SheetJS otherwise treats 04-09-2026 as 9 April.
  const workbook = isCsv
    ? XLSX.read(buf.toString('utf-8'), { type: 'string', raw: true, cellDates: false })
    : XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: isCsv });
};

export const pickField = (row: any, keys: string[]): string => {
  const lowerMap: Record<string, any> = {};
  Object.keys(row || {}).forEach((k) => {
    lowerMap[k.toLowerCase().trim().replace(/^\ufeff/, '').replace(/^"|"$/g, '')] = row[k];
  });
  for (const k of keys) {
    const v = lowerMap[k.toLowerCase().trim()];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
};

export const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isoToLocalDate = (iso: string): Date => {
  const parts = iso.split('-');
  const year = parseInt(parts[0] || '0', 10);
  const month = parseInt(parts[1] || '1', 10);
  const day = parseInt(parts[2] || '1', 10);
  return new Date(year, month - 1, day);
};

export const parseAmount = (raw: unknown): number => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const text = String(raw ?? '').replace(/[^0-9.-]/g, '');
  return parseFloat(text);
};

const parseTransactionType = (raw: unknown): { type: TransactionType | ''; warning?: string } => {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'spending') return { type: 'spending' };
  if (value === 'collection') return { type: 'collection' };
  if (value === 'contribution') {
    return { type: 'collection', warning: 'Interpreted "Contribution" as Collection' };
  }
  return { type: '' };
};

const excelSerialToDate = (serial: number): Date => {
  const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
};

const parsePaymentDate = (raw: unknown): { iso: string; warnings: string[] } => {
  const warnings: string[] = [];
  const clamp = (date: Date): Date => {
    if (date > new Date()) {
      warnings.push('Future date was set to today');
      return new Date();
    }
    return date;
  };

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { iso: toIsoDate(clamp(raw)), warnings };
  }

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20000 && raw < 80000) {
    return { iso: toIsoDate(clamp(excelSerialToDate(raw))), warnings };
  }

  const text = String(raw ?? '').trim();
  if (!text) {
    warnings.push('Missing date; using today');
    return { iso: toIsoDate(new Date()), warnings };
  }

  if (/^\d{4,5}(\.\d+)?$/.test(text)) {
    const serial = parseFloat(text);
    if (serial > 20000 && serial < 80000) {
      return { iso: toIsoDate(clamp(excelSerialToDate(serial))), warnings };
    }
  }

  // ISO first so 2026-04-06 is 6 April, not day=2026.
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const parsed = isoToLocalDate(text.slice(0, 10));
    if (!Number.isNaN(parsed.getTime())) {
      return { iso: toIsoDate(clamp(parsed)), warnings };
    }
  }

  // Indian export format: DD-MM-YYYY / DD/MM/YYYY / D/M/YYYY
  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dmy) {
    const day = parseInt(dmy[1] || '0', 10);
    const month = parseInt(dmy[2] || '0', 10);
    let year = parseInt(dmy[3] || '0', 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { iso: toIsoDate(clamp(new Date(year, month - 1, day))), warnings };
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    warnings.push(`Could not parse date "${text}"; using today`);
    return { iso: toIsoDate(new Date()), warnings };
  }
  return { iso: toIsoDate(clamp(parsed)), warnings };
};

const parseMethod = (raw: unknown): { method: PaymentMethod; warning?: string } => {
  const text = String(raw ?? '').trim();
  const match = VALID_METHODS.find((method) => method.toLowerCase() === text.toLowerCase());
  if (match) return { method: match };
  return { method: 'Cash', warning: text ? `Unknown method "${text}"; defaulted to Cash` : 'Missing payment method; defaulted to Cash' };
};

const firstIn = <T extends string>(value: string, allowed: readonly T[], fallback: T): { value: T; warning?: string } => {
  const match = allowed.find((item) => item.toLowerCase() === value.toLowerCase());
  if (match) return { value: match };
  if (!value) return { value: fallback, warning: `Missing party type; defaulted to ${fallback}` };
  return { value: fallback, warning: `Unknown party type "${value}"; defaulted to ${fallback}` };
};

interface SharedImportFields {
  type?: unknown;
  partyName?: unknown;
  partyType?: unknown;
  amount?: unknown;
  paymentDate?: unknown;
  paymentMethod?: unknown;
  bankName?: unknown;
  senderUpiId?: unknown;
  chequeNumber?: unknown;
  transactionRefId?: unknown;
  notes?: unknown;
}

const finalizeShared = (input: SharedImportFields) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsedType = parseTransactionType(input.type);
  if (parsedType.warning) warnings.push(parsedType.warning);
  if (!parsedType.type) {
    errors.push(`Invalid type "${String(input.type ?? '').trim() || '(empty)'}"`);
  }

  const amount = parseAmount(input.amount);
  if (!amount || amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  const partyName = String(input.partyName ?? '').trim();
  if (!partyName) {
    errors.push('Party name is required');
  }

  const date = parsePaymentDate(input.paymentDate);
  warnings.push(...date.warnings);

  const parsedMethod = parseMethod(input.paymentMethod);
  if (parsedMethod.warning) warnings.push(parsedMethod.warning);
  let resolvedMethod: PaymentMethod = parsedMethod.method;

  const bankName = String(input.bankName ?? '').trim();
  const senderUpiId = String(input.senderUpiId ?? '').trim();
  const chequeNumber = String(input.chequeNumber ?? '').trim();
  const transactionRefId = String(input.transactionRefId ?? '').trim();
  const notes = String(input.notes ?? '').trim();

  let resolvedBank = bankName;
  let resolvedCheque = chequeNumber;
  let resolvedRef = transactionRefId;

  if (resolvedMethod === 'UPI Transfer') {
    if (!senderUpiId) {
      errors.push('Sender UPI ID is required for UPI Transfer');
    } else if (!/^\d+@[a-zA-Z]+$/.test(senderUpiId)) {
      warnings.push('UPI ID is not in number@bank format; saving as Bank Transfer so the row can be imported');
      resolvedMethod = 'Bank Transfer';
    }
  }

  if (resolvedMethod === 'Bank Transfer') {
    if (!resolvedBank) {
      resolvedBank = 'Imported';
      warnings.push('Missing bank name; defaulted to Imported');
    }
    if (transactionRefId) resolvedRef = transactionRefId;
  } else if (resolvedMethod === 'Cheque') {
    if (!resolvedCheque) {
      resolvedCheque = transactionRefId || 'IMPORTED';
      warnings.push(`Missing cheque number; defaulted to ${resolvedCheque}`);
    }
  } else if (resolvedMethod === 'QR Scanner') {
    if (transactionRefId && !/^\d{6,}$/.test(transactionRefId)) {
      warnings.push('Reference ID is not at least 6 digits and will be omitted');
      resolvedRef = '';
    }
  }

  return {
    errors,
    warnings,
    type: parsedType.type,
    partyName,
    amount: amount && amount > 0 ? amount : ('' as const),
    paymentDate: date.iso,
    paymentMethod: resolvedMethod,
    bankName: resolvedBank,
    senderUpiId,
    chequeNumber: resolvedCheque,
    transactionRefId: resolvedRef,
    notes,
  };
};

export const normalizeZakatImportInput = (input: SharedImportFields & { purpose?: unknown }, rowNumber: number): ZakatPreviewRow => {
  const shared = finalizeShared(input);
  const purposeRaw = String(input.purpose ?? '').trim();
  const purpose: ZakatPurpose = purposeRaw.toLowerCase() === 'sadaqah' ? 'Sadaqah' : 'Zakat';
  const warnings = [...shared.warnings];
  if (!purposeRaw) warnings.push('Missing purpose; defaulted to Zakat');

  const partyTypeRaw = String(input.partyType ?? '').trim();
  let partyType = partyTypeRaw;
  if (shared.type === 'collection') {
    const parsed = firstIn(partyTypeRaw, ZAKAT_DONOR_TYPES, 'Individual');
    partyType = parsed.value;
    if (parsed.warning) warnings.push(parsed.warning);
  } else if (shared.type === 'spending') {
    const parsed = firstIn(partyTypeRaw, ZAKAT_RECIPIENT_TYPES, 'Other');
    partyType = parsed.value;
    if (parsed.warning) warnings.push(parsed.warning);
  }

  return {
    rowNumber,
    type: shared.type,
    purpose,
    partyName: shared.partyName,
    partyType,
    amount: shared.amount,
    paymentDate: shared.paymentDate,
    paymentMethod: shared.paymentMethod,
    bankName: shared.bankName,
    senderUpiId: shared.senderUpiId,
    chequeNumber: shared.chequeNumber,
    transactionRefId: shared.transactionRefId,
    notes: shared.notes,
    errors: shared.errors,
    warnings,
  };
};

export const normalizeZakatFileRow = (row: any, rowNumber: number): ZakatPreviewRow =>
  normalizeZakatImportInput({
    type: pickField(row, ['Type', 'type']),
    purpose: pickField(row, ['Purpose', 'purpose']),
    partyName: pickField(row, ['Party Name', 'partyName', 'donorName', 'recipientName', 'Name']),
    partyType: pickField(row, ['Party Type', 'partyType', 'donorType', 'recipientType']),
    amount: pickField(row, ['Amount', 'amount']),
    paymentDate: pickField(row, ['Payment Date', 'paymentDate']),
    paymentMethod: pickField(row, ['Payment Method', 'Method', 'paymentMethod', 'method']),
    bankName: pickField(row, ['Bank Name', 'bankName']),
    senderUpiId: pickField(row, ['Sender UPI ID', 'senderUpiId']),
    chequeNumber: pickField(row, ['Cheque Number', 'chequeNumber']),
    transactionRefId: pickField(row, ['Reference ID', 'transactionRefId', 'Reference', 'refId']),
    notes: pickField(row, ['Notes', 'notes']),
  }, rowNumber);

export const normalizeMaktabImportInput = (
  input: SharedImportFields & { contributionFrequency?: unknown; category?: unknown; studentCount?: unknown; tag?: unknown },
  rowNumber: number
): MaktabPreviewRow => {
  const shared = finalizeShared(input);
  const warnings = [...shared.warnings];
  const frequencyRaw = String(input.contributionFrequency ?? '').trim();
  const categoryRaw = String(input.category ?? '').trim();
  const tag = String(input.tag ?? '').trim() || (shared.type === 'collection' ? frequencyRaw : categoryRaw);

  let contributionFrequency: 'One-time' | 'Monthly' | '' = '';
  let category = '';
  let partyType = String(input.partyType ?? '').trim();
  const studentRaw = input.studentCount;
  const studentParsed = studentRaw === '' || studentRaw == null ? NaN : parseAmount(studentRaw);
  const studentCount = Number.isFinite(studentParsed) && studentParsed >= 0 ? studentParsed : ('' as const);

  if (shared.type === 'collection') {
    const parsedType = firstIn(partyType, MAKTAB_CONTRIBUTOR_TYPES, 'Individual');
    partyType = parsedType.value;
    if (parsedType.warning) warnings.push(parsedType.warning);
    contributionFrequency = tag.toLowerCase() === 'monthly' ? 'Monthly' : 'One-time';
    if (!tag) warnings.push('Missing frequency; defaulted to One-time');
  } else if (shared.type === 'spending') {
    const parsedType = firstIn(partyType, MAKTAB_RECIPIENT_TYPES, 'Other');
    partyType = parsedType.value;
    if (parsedType.warning) warnings.push(parsedType.warning);
    const matchedCategory = MAKTAB_SPENDING_CATEGORIES.find((item) => item.toLowerCase() === tag.toLowerCase());
    category = matchedCategory || 'Other';
    if (!tag) warnings.push('Missing category; defaulted to Other');
    else if (!matchedCategory) warnings.push(`Unknown category "${tag}"; defaulted to Other`);
  }

  return {
    rowNumber,
    type: shared.type,
    partyName: shared.partyName,
    partyType,
    contributionFrequency,
    category,
    studentCount,
    amount: shared.amount,
    paymentDate: shared.paymentDate,
    paymentMethod: shared.paymentMethod,
    bankName: shared.bankName,
    senderUpiId: shared.senderUpiId,
    chequeNumber: shared.chequeNumber,
    transactionRefId: shared.transactionRefId,
    notes: shared.notes,
    errors: shared.errors,
    warnings,
  };
};

export const normalizeMaktabFileRow = (row: any, rowNumber: number): MaktabPreviewRow =>
  normalizeMaktabImportInput({
    type: pickField(row, ['Type', 'type']),
    partyName: pickField(row, ['Party Name', 'partyName', 'contributorName', 'recipientName', 'Name']),
    partyType: pickField(row, ['Party Type', 'partyType', 'contributorType', 'recipientType']),
    amount: pickField(row, ['Amount', 'amount']),
    paymentDate: pickField(row, ['Payment Date', 'paymentDate']),
    paymentMethod: pickField(row, ['Payment Method', 'Method', 'paymentMethod', 'method']),
    bankName: pickField(row, ['Bank Name', 'bankName']),
    senderUpiId: pickField(row, ['Sender UPI ID', 'senderUpiId']),
    chequeNumber: pickField(row, ['Cheque Number', 'chequeNumber']),
    transactionRefId: pickField(row, ['Reference ID', 'transactionRefId', 'Reference', 'refId']),
    notes: pickField(row, ['Notes', 'notes']),
    contributionFrequency: pickField(row, ['Frequency', 'contributionFrequency']),
    category: pickField(row, ['Category', 'category']),
    tag: pickField(row, ['Category/Frequency', 'category', 'contributionFrequency', 'Category', 'Frequency']),
    studentCount: pickField(row, ['Students Supported', 'studentsSupported', 'studentCount', 'students']),
  }, rowNumber);

export const summarizePreviewRows = <T extends { errors: string[] }>(rows: T[]) => ({
  total: rows.length,
  valid: rows.filter((row) => row.errors.length === 0).length,
  errorCount: rows.filter((row) => row.errors.length > 0).length,
});
