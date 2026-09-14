import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Dashboard from './Dashboard';

const mockHasRole = jest.fn();

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', name: 'Admin User', email: 'admin@hikmah.com' },
    hasRole: mockHasRole,
  }),
}));

jest.mock('../components/PageSEO', () => () => null);
jest.mock('../components/Funds/FundsManagement', () => () => <div>Funds panel</div>);
jest.mock('../components/Notifications/AdminNotificationPanel', () => () => <div>Notifications panel</div>);
jest.mock('framer-motion', () => ({
  motion: {
    section: ({ children, ...props }: { children?: React.ReactNode }) => <section {...props}>{children}</section>,
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

const users = [
  {
    _id: 'admin-1',
    username: 'admin',
    email: 'admin@hikmah.com',
    role: 'superadmin',
    isBlocked: false,
    hasValidNotificationDevice: true,
  },
  {
    _id: 'user-2',
    username: 'aisha',
    email: 'aisha@example.com',
    role: 'user',
    isBlocked: false,
    hasValidNotificationDevice: true,
  },
];

beforeEach(() => {
  mockHasRole.mockImplementation((roles: string[]) => roles.includes('superadmin'));
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/admin/users')) {
      return { json: async () => ({ status: 'success', data: { users } }) } as Response;
    }
    if (url.includes('/activity/recent')) {
      return { json: async () => ({ status: 'success', data: { activities: [] } }) } as Response;
    }
    if (url.includes('/activity/stats')) {
      return { json: async () => ({ status: 'success', data: { totalActivities: 12, uniqueUsers: 3 } }) } as Response;
    }
    return { json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
});

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

describe('Dashboard roles', () => {
  it('shows the control center and all four tabs for Super Admin', async () => {
    renderDashboard();

    expect(await screen.findByText('Control Center')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /overview/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /users/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /funds/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /notifications/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /users/i })[0]);
    expect(await screen.findByPlaceholderText(/name, email, or username/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^view$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^block$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /reset password/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^delete$/i }).length).toBeGreaterThan(0);
  });

  it('lands a Manager on Funds only', async () => {
    mockHasRole.mockImplementation((roles: string[]) => roles.includes('manager'));
    renderDashboard();

    expect(await screen.findByText('Fund Management')).toBeInTheDocument();
    expect(screen.queryByText('Control Center')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /overview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /users/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /funds/i }).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByText('Funds panel')).toBeInTheDocument();
    });
  });
});
