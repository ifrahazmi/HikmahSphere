import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

    const version = screen.getByText(/v1\.1\.0/);
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

  it('groups Muhasabah Tracker and Halal Check under Tools in desktop profile dropdown', () => {
    renderNavbar();

    // Open desktop profile dropdown
    const profileButton = screen.getByRole('button', { name: /User/i });
    fireEvent.click(profileButton);

    expect(screen.getByRole('link', { name: /^Profile$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tools$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign out$/i })).toBeInTheDocument();

    // Tools is collapsed by default to save vertical space
    expect(screen.queryByRole('link', { name: /Muhasabah Tracker/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Halal Check/i })).not.toBeInTheDocument();

    // Expand Tools
    fireEvent.click(screen.getByRole('button', { name: /^Tools$/i }));

    expect(screen.getByRole('link', { name: /Muhasabah Tracker/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Halal Check/i })).toBeInTheDocument();
  });

  it('provides scrollable container and groups Tools on mobile so Sign out is accessible', () => {
    const { container } = renderNavbar();

    // Open mobile hamburger menu
    const menuButton = screen.getByLabelText('Open navigation menu');
    fireEvent.click(menuButton);

    // Verify mobile drawer has scrollable viewport-height constraint
    const mobileDrawer = container.querySelector('.xl\\:hidden.max-h-\\[calc\\(100dvh-4rem\\)\\]');
    expect(mobileDrawer).toBeInTheDocument();
    expect(mobileDrawer).toHaveClass('overflow-y-auto');

    // Sign out button must be in document and accessible
    const signOutButtons = screen.getAllByRole('button', { name: /Sign out/i });
    expect(signOutButtons.length).toBeGreaterThanOrEqual(1);

    // Mobile Tools accordion is present
    const toolsButtons = screen.getAllByRole('button', { name: /Tools/i });
    const mobileToolsButton = toolsButtons[toolsButtons.length - 1];
    expect(mobileToolsButton).toBeInTheDocument();

    // Expand Tools on mobile
    fireEvent.click(mobileToolsButton);

    expect(screen.getByRole('link', { name: /Muhasabah Tracker/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Halal Check/i })).toBeInTheDocument();
  });

  it('renders a completely blurred backdrop in mobile mode only when menu is open and dismisses on click or Escape', () => {
    const { container } = renderNavbar();

    // Initially, backdrop is not present
    expect(screen.queryByTestId('mobile-menu-backdrop')).not.toBeInTheDocument();

    // Open mobile menu
    fireEvent.click(screen.getByLabelText('Open navigation menu'));

    // Backdrop blur overlay is present with mobile constraint and deep blur
    const backdrop = screen.getByTestId('mobile-menu-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveClass('xl:hidden', 'backdrop-blur-2xl', 'bg-black/60', 'fixed', 'inset-0');

    // Drawer container also has backdrop-blur-2xl
    const mobileDrawer = container.querySelector('.xl\\:hidden.max-h-\\[calc\\(100dvh-4rem\\)\\]');
    const drawerInner = mobileDrawer?.firstElementChild;
    expect(drawerInner).toHaveClass('backdrop-blur-2xl');

    // Clicking the backdrop closes the menu
    fireEvent.click(backdrop);
    expect(screen.queryByTestId('mobile-menu-backdrop')).not.toBeInTheDocument();

    // Reopen and test Escape key closes the menu
    fireEvent.click(screen.getByLabelText('Open navigation menu'));
    expect(screen.getByTestId('mobile-menu-backdrop')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('mobile-menu-backdrop')).not.toBeInTheDocument();
  });
});
