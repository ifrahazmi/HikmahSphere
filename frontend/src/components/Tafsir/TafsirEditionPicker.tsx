import React from 'react';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import type { TafsirEditionMeta } from '../../types/tafsir';
import { UNIFIED_TAFSIR_EDITION, getEditionPickerCopy, groupEditionsByLanguage } from '../../utils/tafsirEditions';

interface TafsirEditionPickerProps {
  editions: TafsirEditionMeta[];
  value: string;
  onChange: (slug: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: 'light' | 'dark';
  size?: 'sm' | 'md';
}

const TafsirEditionPicker: React.FC<TafsirEditionPickerProps> = ({
  editions,
  value,
  onChange,
  open,
  onOpenChange,
  theme,
  size = 'md',
}) => {
  const isDark = theme === 'dark';
  const selected = editions.find((edition) => edition.slug === value);
  const selectedCopy = getEditionPickerCopy(selected || { slug: value, name: value });
  const groups = groupEditionsByLanguage(
    editions.filter((edition) => edition.slug !== UNIFIED_TAFSIR_EDITION)
  );
  const unified = editions.find((edition) => edition.slug === UNIFIED_TAFSIR_EDITION);
  const compact = size === 'sm';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex w-full items-center justify-between rounded-xl border text-left shadow-sm ${
          compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
        } ${isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-emerald-100 bg-white text-gray-900'}`}
      >
        <span className="min-w-0">
          <span className={`block truncate font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
            {selectedCopy.title}
          </span>
          <span className={`mt-0.5 block truncate ${compact ? 'text-[10px]' : 'text-xs'} ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>
            {selectedCopy.language}
            {selectedCopy.author ? ` · ${selectedCopy.author}` : ''}
          </span>
        </span>
        <ChevronDownIcon className={`ml-2 h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isDark ? 'text-gray-300' : 'text-gray-500'}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className={`mt-2 max-h-72 overflow-y-auto rounded-xl border p-2 shadow-lg ${
            isDark ? 'border-gray-600 bg-gray-800' : 'border-emerald-100 bg-white'
          }`}
        >
          {groups.map((group) => (
            <div key={group.language} className="mb-2 last:mb-0">
              <p className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                isDark ? 'text-emerald-300' : 'text-emerald-700'
              }`}
              >
                {group.label} tafsir
              </p>
              <div className="space-y-1">
                {group.editions.map((option) => {
                  const copy = getEditionPickerCopy(option);
                  const isSelected = value === option.slug;
                  return (
                    <button
                      key={option.slug}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(option.slug);
                        onOpenChange(false);
                      }}
                      className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left ${
                        isSelected
                          ? isDark
                            ? 'bg-emerald-900/80 text-emerald-50'
                            : 'bg-emerald-50 text-emerald-950'
                          : isDark
                            ? 'text-gray-100 hover:bg-gray-700'
                            : 'text-gray-800 hover:bg-emerald-50/70'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={`block font-semibold leading-5 ${compact ? 'text-xs' : 'text-sm'}`}>
                          {copy.title}
                        </span>
                        {copy.author ? (
                          <span className={`mt-0.5 block leading-4 ${compact ? 'text-[10px]' : 'text-xs'} ${
                            isSelected
                              ? isDark ? 'text-emerald-100' : 'text-emerald-800'
                              : isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}
                          >
                            {copy.author}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {unified ? (
            <button
              type="button"
              role="option"
              aria-selected={value === unified.slug}
              onClick={() => {
                onChange(unified.slug);
                onOpenChange(false);
              }}
              className={`mt-1 flex w-full items-start rounded-lg px-2.5 py-2 text-left ${
                value === unified.slug
                  ? isDark ? 'bg-emerald-900/80 text-emerald-50' : 'bg-emerald-50 text-emerald-950'
                  : isDark ? 'text-gray-100 hover:bg-gray-700' : 'text-gray-800 hover:bg-emerald-50/70'
              }`}
            >
              <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
                {getEditionPickerCopy(unified).title}
              </span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TafsirEditionPicker;
