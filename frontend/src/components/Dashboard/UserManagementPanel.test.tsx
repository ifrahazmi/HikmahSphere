import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import UserManagementPanel from './UserManagementPanel';
import { DashboardUser } from './types';

jest.mock('axios');
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

const users: DashboardUser[] = [
  {
    _id: 'admin-1',
    username: 'admin',
    email: 'admin@hikmah.com',
    role: 'superadmin',
    isBlocked: false,
  },
  {
    _id: 'user-2',
    username: 'aisha',
    email: 'aisha@example.com',
    role: 'user',
    isBlocked: false,
    hasValidNotificationDevice: true,
  },
];

const renderPanel = (createUserOpen = false) => {
  const onRefresh = jest.fn().mockResolvedValue(undefined);
  const onCreateUserOpenChange = jest.fn();
  render(
    <UserManagementPanel
      users={users}
      currentUserId="admin-1"
      loading={false}
      onRefresh={onRefresh}
      createUserOpen={createUserOpen}
      onCreateUserOpenChange={onCreateUserOpenChange}
    />
  );
  return { onRefresh, onCreateUserOpenChange };
};

describe('UserManagementPanel modals', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    mockedAxios.post.mockReset();
    mockedAxios.patch.mockReset();
  });

  it('submits the create user modal to the admin users API', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'success' } });
    const { onCreateUserOpenChange, onRefresh } = renderPanel(true);

    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Noor' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Ali' } });
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'noor.ali' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'noor@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password (min 6 characters)'), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/admin\/users$/),
        expect.objectContaining({
          username: 'noor.ali',
          email: 'noor@example.com',
          password: 'secret1',
          firstName: 'Noor',
          lastName: 'Ali',
          role: 'user',
        }),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });
    expect(onCreateUserOpenChange).toHaveBeenCalledWith(false);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('submits the reset password modal to the reset-password API', async () => {
    mockedAxios.patch.mockResolvedValue({ data: { status: 'success' } });
    renderPanel(false);

    const resetButtons = screen.getAllByRole('button', { name: /reset password/i });
    fireEvent.click(resetButtons.find((button) => !(button as HTMLButtonElement).disabled) as HTMLElement);
    fireEvent.change(screen.getByPlaceholderText('Temporary password'), { target: { value: 'TempPass1' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), { target: { value: 'TempPass1' } });
    fireEvent.click(screen.getByRole('button', { name: /^set password$/i }));

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/admin\/users\/user-2\/reset-password$/),
        { temporaryPassword: 'TempPass1' },
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });
  });
});
