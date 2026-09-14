import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ForcePasswordChangeModal from './ForcePasswordChangeModal';

const mockCompletePasswordChange = jest.fn();

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    passwordChangeRequired: true,
    completePasswordChange: mockCompletePasswordChange,
  }),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

describe('ForcePasswordChangeModal', () => {
  beforeEach(() => {
    mockCompletePasswordChange.mockReset();
    mockCompletePasswordChange.mockResolvedValue(undefined);
  });

  it('cannot be dismissed and saves a matching new password', async () => {
    render(<ForcePasswordChangeModal />);

    expect(screen.getByRole('dialog', { name: 'Set a new password' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPass1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));

    await waitFor(() => expect(mockCompletePasswordChange).toHaveBeenCalledWith('NewPass1'));
  });
});
