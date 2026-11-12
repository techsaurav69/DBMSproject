import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { AuthPage } from './AuthPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('starts blank while allowing the browser to offer saved login credentials', () => {
  render(<AuthPage onAuthenticated={vi.fn()} />);
  expect(screen.getByLabelText('Email address')).toHaveValue('');
  expect(screen.getByLabelText('Password')).toHaveValue('');
  expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'username');
  expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  expect(screen.queryByText(/password is prefilled/)).not.toBeInTheDocument();
});

it('submits browser-filled values even without React change events', async () => {
  const response = { accessToken: 'token', user: { id: 'user', displayName: 'Person', email: 'person@example.test', roles: ['citizen'] } };
  const login = vi.spyOn(api, 'login').mockResolvedValue(response);
  const onAuthenticated = vi.fn();
  render(<AuthPage onAuthenticated={onAuthenticated} />);
  (screen.getByLabelText('Email address') as HTMLInputElement).value = 'person@example.test';
  (screen.getByLabelText('Password') as HTMLInputElement).value = 'SavedPassword123';
  fireEvent.submit(screen.getByRole('button', { name: 'Sign in securely' }).closest('form')!);
  await waitFor(() => expect(login).toHaveBeenCalledWith({ email: 'person@example.test', password: 'SavedPassword123' }));
  expect(onAuthenticated).toHaveBeenCalledWith(response);
});
