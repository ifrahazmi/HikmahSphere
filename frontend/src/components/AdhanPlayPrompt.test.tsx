import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdhanPlayPrompt from './AdhanPlayPrompt';
import * as adhanPlayback from '../utils/adhanPlayback';

const mockPlayAdhanFromUserGesture = jest.fn();
const mockPlayAdhanAudio = jest.fn();

jest.mock('../utils/adhanAudio', () => ({
  playAdhanFromUserGesture: (...args: unknown[]) => mockPlayAdhanFromUserGesture(...args),
  playAdhanAudio: (...args: unknown[]) => mockPlayAdhanAudio(...args),
}));

describe('AdhanPlayPrompt', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockPlayAdhanFromUserGesture.mockClear();
    mockPlayAdhanAudio.mockClear();
    jest.spyOn(adhanPlayback, 'isMobileDevice').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the play prompt when adhan playback is queued', () => {
    adhanPlayback.queueAdhanPlayback('Fajr', 'notification');

    render(
      <MemoryRouter>
        <AdhanPlayPrompt />
      </MemoryRouter>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Time for Fajr/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Play Adhan/i })).toBeInTheDocument();
  });

  it('plays adhan from the user gesture button', () => {
    adhanPlayback.queueAdhanPlayback('Maghrib', 'notification');

    render(
      <MemoryRouter>
        <AdhanPlayPrompt />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Play Adhan/i }));
    expect(mockPlayAdhanFromUserGesture).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the prompt when navigating with playAdhan query param', () => {
    render(
      <MemoryRouter initialEntries={['/prayers?playAdhan=1&prayer=Isha']}>
        <AdhanPlayPrompt />
      </MemoryRouter>
    );

    expect(screen.getByText(/Time for Isha/i)).toBeInTheDocument();
  });
});
