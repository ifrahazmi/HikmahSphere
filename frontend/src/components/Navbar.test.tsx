import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    logout: jest.fn(),
    hasRole: () => false,
  }),
}));

jest.mock('../contexts/DarkModeContext', () => ({
  useDarkMode: () => ({ isDarkMode: false }),
}));

jest.mock('./Notifications/NotificationBell', () => () => (
  <button type="button" aria-label="Notifications">Bell</button>
));

jest.mock('./SettingsModal', () => () => null);

const renderNavbar = (user?: { name: string; email: string } | null) => {
  window.scrollTo = jest.fn();
  return render(
    <MemoryRouter>
      <Navbar user={user === undefined ? { name: 'User', email: 'user@example.com' } : user ?? undefined} />
    </MemoryRouter>
  );
};

describe('Navbar layout', () => {
  it('keeps the mobile bell, theme, settings, and menu button reachable', () => {
    renderNavbar();

    expect(screen.getAllByLabelText('Notifications')).toHaveLength(2);
    expect(screen.getByLabelText('Toggle dark mode')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Settings')).toHaveLength(2);
    expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
  });

  it('hides the settings button until the user is logged in', () => {
    renderNavbar(null);

    expect(screen.queryByLabelText('Settings')).not.toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('stacks the version badge under the name without taking extra width', () => {
    renderNavbar();

    const version = screen.getByText(/v1\.0\.2/);
    expect(version).not.toHaveClass('hidden');

    const brandText = screen.getByText('HikmahSphere').closest('div');
    expect(brandText).toHaveClass('flex-col', 'min-w-0');
    expect(brandText).toHaveClass('ml-2');
  });

  it('never lets the brand grow into the space the desktop menu needs', () => {
    const { container } = renderNavbar();

    const brandBlock = screen.getByText('HikmahSphere').closest('a')?.parentElement;
    expect(brandBlock).toHaveClass('shrink');
    expect(brandBlock).not.toHaveClass('flex-1');

    // The menu takes the remaining width and the action icons stay above it,
    // so nowrap menu items can never paint over the bell or settings.
    const desktopMenu = container.querySelector('.hidden.xl\\:flex.flex-1');
    expect(desktopMenu).toHaveClass('justify-center', 'min-w-0');

    const desktopActions = screen.getAllByLabelText('Notifications')[0]?.parentElement;
    expect(desktopActions).toHaveClass('shrink-0', 'z-20');
  });
});
