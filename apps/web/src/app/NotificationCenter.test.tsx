import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api, type NotificationItem } from '../lib/api';
import { NotificationCenter } from './NotificationCenter';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('opens the saved SOS location when its notification is selected', async () => {
  const item: NotificationItem = { id: 'sos:request', kind: 'sos', severity: 'high', title: 'New SOS request', message: 'Nuwakot needs rescue support', timestamp: new Date().toISOString(), read: false, location: { latitude: 27.92, longitude: 85.16, label: 'Nuwakot', incidentId: 'incident', requestId: 'request' } };
  vi.spyOn(api, 'notifications').mockResolvedValue({ items: [item], unreadCount: 1 });
  vi.spyOn(api, 'markNotificationRead').mockResolvedValue({ ok: true });
  const onOpen = vi.fn();
  render(<NotificationCenter accessToken="token" refreshKey={0} onOpen={onOpen} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open local notifications' }));
  fireEvent.click(await screen.findByRole('button', { name: /New SOS request/ }));
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith(item));
  expect(api.markNotificationRead).toHaveBeenCalledWith('token', item.id);
});
