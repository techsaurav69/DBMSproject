import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api, type OperationsOverview } from '../lib/api';
import { RequestComposer } from './RequestComposer';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const incidents: OperationsOverview['incidents'] = [
  { id: 'first-incident', emergencyType: 'flood', label: 'North area', severity: 'high', description: 'Flood assistance needed', latitude: 12, longitude: 77, reportedAt: new Date().toISOString(), status: 'reported' },
  { id: 'second-incident', emergencyType: 'medical_emergency', label: 'South area', severity: 'critical', description: 'Medical assistance needed', latitude: 12, longitude: 77, reportedAt: new Date().toISOString(), status: 'reported' },
];

it('links the selected search suggestion by ID and sends valid category and urgency values', async () => {
  const create = vi.spyOn(api, 'createRequest').mockResolvedValue({ id: 'request' } as never);
  render(<RequestComposer accessToken="token" incidents={incidents} onClose={vi.fn()} onCreated={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Linked incident'), { target: { value: 'Medical Emergency · South area · Critical' } });
  fireEvent.change(screen.getByLabelText('Request category'), { target: { value: 'medical' } });
  fireEvent.change(screen.getByLabelText('Urgency'), { target: { value: 'high' } });
  fireEvent.change(screen.getByLabelText('Operational details'), { target: { value: 'Medical assistance is needed here.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create local request' }));
  await waitFor(() => expect(create).toHaveBeenCalledWith('token', expect.objectContaining({ incidentId: 'second-incident', category: 'medical', urgency: 'high' })));
});

it('does not submit an arbitrary typed name as an incident link', () => {
  const create = vi.spyOn(api, 'createRequest');
  render(<RequestComposer accessToken="token" incidents={incidents} onClose={vi.fn()} onCreated={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Linked incident'), { target: { value: 'A place without an incident' } });
  expect(screen.getByRole('button', { name: 'Create local request' })).toBeDisabled();
  expect(create).not.toHaveBeenCalled();
});
