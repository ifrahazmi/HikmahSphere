import React from 'react';
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';

let mockAuthLoading = false;
let mockStartupReadiness: any = {
  enabled: false,
  state: { outcome: 'ready', steps: {} },
  retry: jest.fn(),
};

jest.mock('./firebase', () => ({
  requestForToken: jest.fn().mockResolvedValue(null),
  getPushSupportInfo: jest.fn().mockResolvedValue({
    supported: false,
    isIOS: false,
    isStandalone: false,
    limitations: [],
  }),
  getPushDeviceId: () => 'test-device',
  getPushConfigurationIssue: () => null,
  storePushToken: jest.fn(),
  onMessageListener: () => jest.fn(),
}));

jest.mock('./components/PageSEO', () => () => null);

jest.mock('./hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: null,
    loading: mockAuthLoading,
    sessionStatus: 'ready',
    logout: jest.fn(),
    hasRole: () => false,
  }),
}));

jest.mock('./hooks/useStartupReadiness', () => ({
  useStartupReadiness: () => mockStartupReadiness,
}));

beforeEach(() => {
  mockAuthLoading = false;
  mockStartupReadiness = {
    enabled: false,
    state: { outcome: 'ready', steps: {} },
    retry: jest.fn(),
  };
  window.scrollTo = jest.fn();
  window.IntersectionObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
    root = null;
    rootMargin = '';
    thresholds = [];
    takeRecords = () => [];
  } as unknown as typeof IntersectionObserver;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  localStorage.setItem('hs_app_installed', '1');
});

test('renders the HikmahSphere application shell', () => {
  render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
  expect(screen.getAllByText('HikmahSphere').length).toBeGreaterThan(0);
});

test('blocks the installed PWA shell until startup checks pass', () => {
  mockStartupReadiness = {
    enabled: true,
    state: {
      outcome: 'checking',
      steps: {
        internet: { status: 'success', message: 'Internet connected' },
        frontend: { status: 'success', message: 'App interface loaded' },
        backend: { status: 'checking', message: 'Connecting to the server…' },
        database: { status: 'waiting', message: 'Waiting for the server…' },
      },
    },
    retry: jest.fn(),
  };

  render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

  expect(screen.getByText('Startup check')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Preparing HikmahSphere' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

test('keeps the readiness screen instead of flashing the old spinner during auth bootstrap', () => {
  mockAuthLoading = true;
  mockStartupReadiness = {
    enabled: true,
    state: {
      outcome: 'ready',
      steps: {
        internet: { status: 'success', message: 'Internet connected' },
        frontend: { status: 'success', message: 'App interface loaded' },
        backend: { status: 'success', message: 'Server is responding' },
        database: { status: 'success', message: 'Database connected' },
      },
    },
    retry: jest.fn(),
  };

  render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

  expect(screen.getByRole('heading', { name: 'Restoring your session' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

test('shows a clear tasbih input mode switch between stone/scroll and tap', () => {
  window.history.pushState({}, '', '/dhikr-dua');

  render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

  expect(screen.getByRole('button', { name: 'Stone / Scroll' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tap' })).toBeInTheDocument();
});
