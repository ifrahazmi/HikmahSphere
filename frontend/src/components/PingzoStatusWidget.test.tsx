import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PingzoStatusWidget from './PingzoStatusWidget';

describe('PingzoStatusWidget', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders loading state initially and then displays operational status from Pingzo', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'green',
        statusUrl: 'https://pingzoapp.vercel.app/status/ifrahuddin-azmi',
        siteId: 'cmv41n3wg018uk206v73c9fy9',
      }),
    } as Response);

    render(<PingzoStatusWidget />);

    expect(screen.getByText(/checking server status/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: /all systems operational/i });
    expect(link).toHaveAttribute('href', 'https://pingzoapp.vercel.app/status/ifrahuddin-azmi');
  });

  it('handles partial outage status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'yellow',
        statusUrl: 'https://pingzoapp.vercel.app/status/ifrahuddin-azmi',
      }),
    } as Response);

    render(<PingzoStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Partial Outage')).toBeInTheDocument();
    });
  });

  it('handles fetch failure gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    render(<PingzoStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Server Status Unavailable')).toBeInTheDocument();
    });
  });
});

