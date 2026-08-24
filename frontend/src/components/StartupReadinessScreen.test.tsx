import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import StartupReadinessScreen from './StartupReadinessScreen';
import type { StartupReadinessState } from '../hooks/useStartupReadiness';

const checkingState: StartupReadinessState = {
  outcome: 'checking',
  steps: {
    internet: { status: 'success', message: 'Internet connected' },
    frontend: { status: 'success', message: 'App interface loaded' },
    backend: { status: 'slow', message: 'Server is waking up…' },
    database: { status: 'waiting', message: 'Waiting for the server…' },
  },
};

describe('StartupReadinessScreen', () => {
  it('renders checks in dependency order with current statuses', () => {
    render(
      <StartupReadinessScreen
        state={checkingState}
        authReady={false}
        onRetry={jest.fn()}
      />
    );

    const labels = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
    expect(labels).toEqual([
      'Internet connection',
      'HikmahSphere app',
      'HikmahSphere server',
      'Secure database',
    ]);
    expect(screen.getByText('Server is waking up…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('shows disconnect artwork and retry guidance when offline', () => {
    const retry = jest.fn();
    const offlineState: StartupReadinessState = {
      outcome: 'offline',
      steps: {
        internet: { status: 'error', message: 'Internet is unavailable' },
        frontend: { status: 'waiting', message: 'Waiting for internet' },
        backend: { status: 'waiting', message: 'Waiting for internet' },
        database: { status: 'waiting', message: 'Waiting for internet' },
      },
    };

    render(
      <StartupReadinessScreen state={offlineState} authReady onRetry={retry} />
    );

    expect(screen.getByRole('img', { name: 'No internet connection' })).toHaveAttribute(
      'src',
      '/disconnect.png'
    );
    expect(screen.getByText(/check wi-fi or mobile data/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry startup check/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps the readiness screen while authentication finishes', () => {
    const readyState: StartupReadinessState = {
      outcome: 'ready',
      steps: {
        internet: { status: 'success', message: 'Internet connected' },
        frontend: { status: 'success', message: 'App interface loaded' },
        backend: { status: 'success', message: 'Server is responding' },
        database: { status: 'success', message: 'Database connected' },
      },
    };

    render(
      <StartupReadinessScreen state={readyState} authReady={false} onRetry={jest.fn()} />
    );

    expect(screen.getByRole('heading', { name: 'Restoring your session' })).toBeInTheDocument();
    expect(screen.getByText('Finishing securely…')).toBeInTheDocument();
  });
});

