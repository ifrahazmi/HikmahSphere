import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Auth from './Auth';

const mockLogin = jest.fn();

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: jest.fn(),
    user: null,
    passwordChangeRequired: false,
  }),
}));

jest.mock('../components/PageSEO', () => () => null);

const renderAuth = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <Auth />
      </MemoryRouter>
    </HelmetProvider>
  );

describe('Auth login errors and recovery', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    localStorage.clear();
  });

  it('shows an incorrect email or password error instead of the crash modal', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    renderAuth();

    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'aisha@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.queryByText(/server crash/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lost all saved credentials/i)).not.toBeInTheDocument();
  });

  it('opens the forgot email or password form', () => {
    renderAuth();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot email or password?' }));
    expect(screen.getByRole('dialog', { name: 'Forgot email or password?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact number')).toBeInTheDocument();
  });
});
