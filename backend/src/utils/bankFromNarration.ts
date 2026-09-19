const NARRATION_BANK_CODES: Record<string, string> = {
  ICIC: 'ICICI',
  HDFC: 'HDFC',
  SBIN: 'SBI',
  UTIB: 'Axis Bank',
  BARB: 'Bank of Baroda',
  UBIN: 'Union Bank',
  INDB: 'IndusInd',
  KKBK: 'Kotak',
  CITI: 'Citi',
  YESB: 'Yes Bank',
  PUNB: 'PNB',
  CNRB: 'Canara',
  IDFB: 'IDFC First',
  IOBA: 'Indian Overseas',
  BKID: 'Bank of India',
  MAHB: 'Bank of Maharashtra',
  FDRL: 'Federal Bank',
  AIRP: 'Airtel Payments',
  PYTM: 'Paytm Payments',
};

export const bankFromNarration = (notes?: string): string => {
  if (!notes) return '';
  const parts = notes.toUpperCase().split(/[^A-Z0-9]+/);
  for (const part of parts) {
    const name = NARRATION_BANK_CODES[part];
    if (name) return name;
  }
  return '';
};

export const resolveStoredBankName = (bankName?: string, notes?: string): string => {
  const stored = typeof bankName === 'string' ? bankName.trim() : '';
  if (stored && stored.toLowerCase() !== 'imported') return stored;
  return bankFromNarration(typeof notes === 'string' ? notes : '') || stored;
};

export const attachResolvedBankName = (payment: any): any => {
  if (!payment) return payment;
  const obj = typeof payment.toObject === 'function' ? payment.toObject({ virtuals: true }) : { ...payment };
  const resolved = resolveStoredBankName(obj.bankName, obj.notes);
  if (resolved) obj.bankName = resolved;
  return obj;
};
