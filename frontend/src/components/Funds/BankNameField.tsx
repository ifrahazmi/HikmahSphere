import React from 'react';

type BankNameFieldProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  compact?: boolean;
  tone?: 'indigo' | 'emerald' | 'red';
};

const FOCUS: Record<NonNullable<BankNameFieldProps['tone']>, string> = {
  indigo: 'focus:ring-indigo-500 focus:border-indigo-500',
  emerald: 'focus:ring-emerald-500 focus:border-emerald-500',
  red: 'focus:ring-red-500 focus:border-red-500',
};

const BankNameField: React.FC<BankNameFieldProps> = ({
  value,
  onChange,
  required = false,
  compact = false,
  tone = 'indigo',
}) => (
  <div>
    <label className={`block text-gray-700 ${compact ? 'text-sm font-medium mb-1' : 'text-sm font-semibold mb-2'}`}>
      Bank Name{' '}
      {required ? (
        <span className="text-red-500">*</span>
      ) : (
        <span className="font-normal text-gray-400">(optional)</span>
      )}
    </label>
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="e.g. HDFC, ICICI, SBI"
      required={required}
      className={
        compact
          ? `w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 ${FOCUS[tone]}`
          : `w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 ${FOCUS[tone]}`
      }
    />
  </div>
);

export default BankNameField;
