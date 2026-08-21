import React from 'react';
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';

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
    loading: false,
    logout: jest.fn(),
    hasRole: () => false,
  }),
}));

beforeEach(() => {
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
