import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccountRecoveryModal from './AccountRecoveryModal';
import { API_URL } from '../config';

describe('AccountRecoveryModal', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', message: 'We received your request. An admin will contact you shortly.' }),
    });
  });

  it('requires name, email, and phone before submit', async () => {
    render(<AccountRecoveryModal open onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter your name, email, and contact number.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('posts the recovery request to the support API', async () => {
    const onClose = jest.fn();
    render(<AccountRecoveryModal open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Aisha Rahman' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'Aisha@Example.com' } });
    fireEvent.change(screen.getByLabelText('Contact number'), { target: { value: '9998887776' } });
    fireEvent.change(screen.getByLabelText(/Message/), { target: { value: 'Please reset my password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`${API_URL}/support/account-recovery`, expect.objectContaining({
        method: 'POST',
      }));
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({
      name: 'Aisha Rahman',
      email: 'aisha@example.com',
      phone: '9998887776',
      message: 'Please reset my password',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
