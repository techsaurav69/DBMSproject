import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'crisisgrid-api', database: 'reachable' }),
    }));
  });

  it('shows the prototype safety notice and sign-in experience', () => {
    render(<App />);
    expect(screen.getByText(/does not contact emergency services/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in securely/i })).toBeInTheDocument();
  });
});

