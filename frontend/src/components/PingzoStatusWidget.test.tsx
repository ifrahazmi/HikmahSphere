import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PingzoStatusWidget from './PingzoStatusWidget';

describe('PingzoStatusWidget', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders loading state initially and then displays operational status from backend verification', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        message: 'HikmahSphere API is running! 🕌',
        services: {
          database: 'connected',
          redis: 'connected',
        },
      }),
    } as Response);

    render(
      <MemoryRouter>
        <PingzoStatusWidget />
      </MemoryRouter>
    );

    expect(screen.getByText(/checking server status/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: /all systems operational/i });
    expect(link).toHaveAttribute('href', '/status');
  });

  it('handles partial outage status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        services: {
          database: 'disconnected',
        },
      }),
    } as Response);

    render(
      <MemoryRouter>
        <PingzoStatusWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Partial Outage')).toBeInTheDocument();
    });
  });

  it('handles fetch failure gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <PingzoStatusWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Server Status Unavailable')).toBeInTheDocument();
    });
  });
});
