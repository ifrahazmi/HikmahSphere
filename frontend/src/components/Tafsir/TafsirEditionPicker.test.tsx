import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TafsirEditionPicker from './TafsirEditionPicker';
import { FALLBACK_TAFSIR_EDITIONS } from '../../utils/tafsirEditions';

describe('TafsirEditionPicker', () => {
  it('groups editions by language and shows name plus author', () => {
    const onChange = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <TafsirEditionPicker
        editions={FALLBACK_TAFSIR_EDITIONS}
        value={FALLBACK_TAFSIR_EDITIONS[0].slug}
        onChange={onChange}
        open
        onOpenChange={onOpenChange}
        theme="light"
      />
    );

    expect(screen.getByText('Urdu tafsir')).toBeInTheDocument();
    expect(screen.getByText('English tafsir')).toBeInTheDocument();
    expect(screen.getAllByText('Tafsir Bayan ul Quran').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dr. Israr Ahmad').length).toBeGreaterThan(0);
    expect(screen.getByText('Tafhim-ul-Quran (Short)')).toBeInTheDocument();
    expect(screen.getByText('Syed Abul Ala Maududi')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tafsir Ibn Kathir (abridged)'));
    expect(onChange).toHaveBeenCalledWith('en-tafisr-ibn-kathir');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
