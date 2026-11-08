import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SystemStatus from './SystemStatus';

describe('SystemStatus Page', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders System Pulse header and operational status when backend is healthy', async () => {
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
        <SystemStatus />
      </MemoryRouter>
    );

    expect(screen.getByText('System Pulse')).toBeInTheDocument();
    expect(screen.getByText('Live Monitor')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    });

    expect(screen.getByText('Frontend Web App')).toBeInTheDocument();
    expect(screen.getByText('Cloudflare R2 Storage')).toBeInTheDocument();
    expect(screen.getByText('Core REST API')).toBeInTheDocument();
    expect(screen.getByText('MongoDB Primary Database')).toBeInTheDocument();
    expect(screen.getByText('Redis In-Memory Cache')).toBeInTheDocument();
    expect(screen.queryByText(/powered by pingzo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/whatsapp api monitoring/i)).not.toBeInTheDocument();
  });

  it('renders service interruption when backend is down', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <SystemStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Service Interruption Reported')).toBeInTheDocument();
    });
  });
});
