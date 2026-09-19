import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ScrollManager, { pinWindowToTop } from './ScrollManager';

describe('ScrollManager', () => {
  beforeEach(() => {
    window.scrollTo = jest.fn();
    Object.defineProperty(window.history, 'scrollRestoration', {
      configurable: true,
      writable: true,
      value: 'auto',
    });
  });

  it('pins the window to the top and disables browser restoration', () => {
    pinWindowToTop();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);

    render(
      <MemoryRouter initialEntries={['/prayers?tab=mosques']}>
        <ScrollManager />
        <Routes>
          <Route path="/prayers" element={<div>Prayers</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(window.history.scrollRestoration).toBe('manual');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('does not steal a hash target on first paint', () => {
    const scrollTo = window.scrollTo as jest.Mock;
    scrollTo.mockClear();

    render(
      <MemoryRouter initialEntries={['/maktab#sponsor']}>
        <ScrollManager />
        <Routes>
          <Route path="/maktab" element={<div>Maktab</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
