import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ServerStatusModal from './ServerStatusModal';

describe('ServerStatusModal', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.resetAllMocks();
  });

  it('renders modal when serverHasIssue is true', () => {
    render(<ServerStatusModal serverHasIssue />);
    expect(screen.getByText('Server Status Alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view status page/i })).toHaveAttribute(
      'href',
      'https://pingzoapp.vercel.app/status/ifrahuddin-azmi'
    );
  });

  it('does not render modal when there is no issue and not forced', () => {
    render(<ServerStatusModal serverHasIssue={false} />);
    expect(screen.queryByText('Server Status Alert')).not.toBeInTheDocument();
  });

  it('dismisses modal when close button is clicked and saves once-per-visit to sessionStorage', () => {
    const handleClose = jest.fn();
    render(<ServerStatusModal serverHasIssue onClose={handleClose} />);

    expect(screen.getByText('Server Status Alert')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close status alert/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('pingzo_server_issue_dismissed_session')).toBe('true');
    expect(screen.queryByText('Server Status Alert')).not.toBeInTheDocument();
  });

  it('honors existing sessionStorage dismissal and does not show modal again in same visit', () => {
    sessionStorage.setItem('pingzo_server_issue_dismissed_session', 'true');
    render(<ServerStatusModal serverHasIssue />);

    expect(screen.queryByText('Server Status Alert')).not.toBeInTheDocument();
  });
});
