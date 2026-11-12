import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { SosReporter } from './SosReporter';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const location = { position: { latitude: 12.97, longitude: 77.59 }, placeName: 'Bengaluru' };
function details(): void { fireEvent.change(screen.getByLabelText('What happened?'), { target: { value: 'Rescue assistance is needed at the reported place.' } }); }

it.each(['medium', 'high', 'critical'])('sends the selected %s urgency as the API enum value', async (severity) => {
  const create = vi.spyOn(api, 'createSos').mockResolvedValue({ incidentId: 'incident', requestId: 'request', status: 'open' });
  const onCreated = vi.fn();
  render(<SosReporter accessToken="token" location={location} onClose={vi.fn()} onCreated={onCreated} />);
  details(); fireEvent.change(screen.getByLabelText('Urgency'), { target: { value: severity } });
  fireEvent.click(screen.getByRole('button', { name: 'Send in-app SOS' }));
  await waitFor(() => expect(create).toHaveBeenCalledWith('token', expect.objectContaining({ severity, latitude: 12.97, longitude: 77.59, locationLabel: 'Bengaluru', locationSource: 'gps' })));
  expect(onCreated).toHaveBeenCalledTimes(1);
});

it('never prepopulates fixed demo coordinates when GPS is missing', () => {
  render(<SosReporter accessToken="token" onClose={vi.fn()} onCreated={vi.fn()} />);
  expect(screen.getByLabelText('Latitude')).toHaveValue(null);
  expect(screen.getByLabelText('Longitude')).toHaveValue(null);
});

it('clears the old coordinates when the reported place changes', () => {
  const create = vi.spyOn(api, 'createSos');
  render(<SosReporter accessToken="token" location={location} onClose={vi.fn()} onCreated={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Location label'), { target: { value: 'Another district' } });
  expect(screen.getByLabelText('Latitude')).toHaveValue(null);
  expect(screen.getByLabelText('Longitude')).toHaveValue(null);
  details(); fireEvent.click(screen.getByRole('button', { name: 'Send in-app SOS' }));
  expect(create).not.toHaveBeenCalled();
});

it('uses the selected place coordinates rather than the previous live location', async () => {
  vi.spyOn(api, 'searchPlaces').mockResolvedValue({ items: [{ name: 'Nuwakot, Nepal', latitude: 27.92, longitude: 85.16 }] });
  const create = vi.spyOn(api, 'createSos').mockResolvedValue({ incidentId: 'incident', requestId: 'request', status: 'open' });
  render(<SosReporter accessToken="token" location={location} onClose={vi.fn()} onCreated={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Location label'), { target: { value: 'Nuwakot Nepal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find place' }));
  fireEvent.click(await screen.findByRole('button', { name: /Nuwakot, Nepal/ }));
  details(); fireEvent.click(screen.getByRole('button', { name: 'Send in-app SOS' }));
  await waitFor(() => expect(create).toHaveBeenCalledWith('token', expect.objectContaining({ latitude: 27.92, longitude: 85.16, locationLabel: 'Nuwakot, Nepal', locationSource: 'manual' })));
});
