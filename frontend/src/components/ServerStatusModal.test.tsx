import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServerStatusModal from './ServerStatusModal';

describe('ServerStatusModal', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.resetAllMocks();
  });

  it('renders modal when forceOpen is true', () => {
    render(
      <MemoryRouter>
        <ServerStatusModal forceOpen />
      </MemoryRouter>
    );
    expect(screen.getByText('Server Status Alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view status page/i })).toHaveAttribute(
      'href',
      '/status'
    );
  });

  it('does not render modal when there is no issue and not forced', () => {
    render(
      <MemoryRouter>
        <ServerStatusModal serverHasIssue={false} />
      </MemoryRouter>
    );
    expect(screen.queryByText('Server Status Alert')).not.toBeInTheDocument();
  });

  it('renders modal when serverHasIssue is true and live check confirms down', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Server unreachable'));

    render(
      <MemoryRouter>
        <ServerStatusModal serverHasIssue />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Server Status Alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /view status page/i })).toHaveAttribute(
      'href',
      '/status'
    );
  });

  it('dismisses modal when close button is clicked and saves once-per-visit to sessionStorage', () => {
    const handleClose = jest.fn();
    render(
      <MemoryRouter>
        <ServerStatusModal forceOpen onClose={handleClose} />
      </MemoryRouter>
    );

    expect(screen.getByText('Server Status Alert')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close status alert/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('pingzo_server_issue_dismissed_session')).toBe('true');
    expect(screen.queryByText('Server Status Alert')).not.toBeInTheDocument();
  });

  it('honors existing sessionStorage dismissal and does not show modal again in same visit', () => {
    sessionStorage.setItem('pingzo_server_issue_dismissed_session', 'true');
    render(
      <MemoryRouter>
        <ServerStatusModal serverHasIssue />
      </MemoryRouter>
    );

    expect(screen.queryByText('Server Status Alert')).not.toBeInTheDocument();
  });
});
