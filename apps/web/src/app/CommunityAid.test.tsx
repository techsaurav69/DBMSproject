import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, type CommunityGroup, type CommunityOverview } from '../lib/api';
import { CommunityAid } from './CommunityAid';
import { readCommunityImage } from './CommunityMedia';

const base: CommunityGroup = { id: 'g1', name: 'Neighbour aid', summary: 'Practical local support', focusArea: 'food', location: 'Bengaluru', memberCount: 2, pledgeCount: 0, joined: true, creatorName: 'Owner', createdAt: '2026-11-12T10:00:00Z', status: 'approved', rejectionReason: null, canManage: false, hasLogo: false, hasQr: false, qrCaption: '', mediaVersion: 1, announcement: '', announcementAt: null };
let overview: CommunityOverview;
beforeEach(() => {
  overview = { groups: [base], pledges: [], canModerate: false };
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
  vi.spyOn(api, 'communityOverview').mockImplementation(async () => overview);
  vi.spyOn(api, 'communityMessages').mockResolvedValue({ items: [], hasMore: false });
  vi.spyOn(api, 'communityGroup').mockImplementation(async () => overview.groups[0]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('shows three compact approved cards and expands the rest', async () => {
  overview.groups = Array.from({ length: 5 }, (_, index) => ({ ...base, id: `g${index}`, name: `Community ${index}` }));
  render(<CommunityAid accessToken="test" />);
  await screen.findByText('Community 0');
  expect(screen.getAllByRole('button', { name: 'Open' })).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'View all communities (5)' }));
  expect(screen.getAllByRole('button', { name: 'Open' })).toHaveLength(5);
});

it('keeps pending requests separate from approved cards and opens coordinator review', async () => {
  overview = { groups: [{ ...base, status: 'pending', name: 'Pending group' }], pledges: [], canModerate: true };
  render(<CommunityAid accessToken="test" />);
  await screen.findByText('Pending approval');
  expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Review request' }));
  expect(screen.getByRole('button', { name: 'Approve community' })).toBeInTheDocument();
  expect(api.communityMessages).not.toHaveBeenCalled();
});

it('submits a new community as a private approval request in a dialog', async () => {
  vi.spyOn(api, 'createCommunityGroup').mockImplementation(async (_token, input) => { const created = { ...base, ...input, status: 'pending' as const }; overview.groups = [created]; return created; });
  render(<CommunityAid accessToken="test" />);
  await screen.findByText('Neighbour aid');
  fireEvent.click(screen.getByRole('button', { name: /Form a community/ }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Community name'), { target: { value: 'New group' } });
  fireEvent.change(within(dialog).getByLabelText('Location'), { target: { value: 'Jayanagar' } });
  fireEvent.change(within(dialog).getByLabelText('How will this group help?'), { target: { value: 'Helping local neighbours' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));
  await waitFor(() => expect(api.createCommunityGroup).toHaveBeenCalledWith('test', expect.objectContaining({ name: 'New group', location: 'Jayanagar' })));
  await screen.findByText('Community submitted for coordinator approval.');
});

it('does not load chat for nonmembers and retains the join option', async () => {
  overview.groups = [{ ...base, joined: false }];
  render(<CommunityAid accessToken="test" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Join community' })).toBeInTheDocument();
  expect(within(dialog).queryByLabelText('Message to members')).not.toBeInTheDocument();
  expect(api.communityMessages).not.toHaveBeenCalled();
});

it('renders a pinned announcement and persistent member messages in the dialog', async () => {
  overview.groups = [{ ...base, announcement: 'Volunteer meeting tomorrow' }];
  vi.mocked(api.communityMessages).mockResolvedValue({ items: [{ id: 'm1', body: 'I can help', senderName: 'Asha', createdAt: base.createdAt, mine: false }], hasMore: false });
  render(<CommunityAid accessToken="test" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  expect(screen.getByText('Volunteer meeting tomorrow')).toBeInTheDocument();
  expect(await screen.findByText('I can help')).toBeInTheDocument();
  expect(screen.getByText('Asha')).toBeInTheDocument();
  expect(screen.getByLabelText('Message to members')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Recent offers' })).toBeInTheDocument();
});

it('preserves the Offer help form and records a support offer', async () => {
  vi.spyOn(api, 'createCommunityPledge').mockResolvedValue({ id: 'p1', groupId: 'g1', groupName: base.name, contributorName: 'Owner', createdAt: base.createdAt, details: 'Available tomorrow', kind: 'volunteer_time', quantity: 1, unitLabel: 'hours' });
  render(<CommunityAid accessToken="test" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Offer help' }));
  fireEvent.change(screen.getByLabelText('What can you offer?'), { target: { value: 'Available tomorrow' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record offer' }));
  await waitFor(() => expect(api.createCommunityPledge).toHaveBeenCalledWith('test', 'g1', expect.objectContaining({ details: 'Available tomorrow' })));
  expect(await screen.findByText('Your support offer has been recorded.')).toBeInTheDocument();
});

it('rejects unsupported and oversized uploads before reading them', async () => {
  await expect(readCommunityImage(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))).rejects.toThrow('PNG');
  await expect(readCommunityImage(new File([new Uint8Array(524289)], 'large.png', { type: 'image/png' }))).rejects.toThrow('512 KB');
});
