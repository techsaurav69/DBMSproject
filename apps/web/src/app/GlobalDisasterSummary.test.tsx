import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GlobalDisasterSummary } from './GlobalDisasterSummary';
import type { GdacsEvents } from '../lib/api';

afterEach(cleanup);
const empty = { earthquakes: null, gdacs: null, nasa: null, hazards: null, failedSources: [], loading: false };
const alerts: GdacsEvents = { advisory: true, source: 'GDACS', fetchedAt: '2026-11-12T10:00:00Z', events: [
  { id: '1', title: 'Lower priority event', alertLevel: 'green', eventType: 'EQ', latitude: 10, longitude: 20, sourceUrl: 'https://www.gdacs.org/', time: '2026-11-12T10:00:00Z' },
  { id: '2', title: 'Severe flood report', alertLevel: 'red', eventType: 'FL', latitude: 15, longitude: 25, sourceUrl: 'https://www.gdacs.org/', time: '2026-11-12T09:00:00Z' },
  { id: '3', title: 'Unlocated event', alertLevel: 'red', eventType: 'FL', latitude: null, longitude: null, sourceUrl: 'https://www.gdacs.org/', time: null },
] };

describe('real-world disaster overview', () => {
  it('features the highest-priority mapped alert and counts only mapped records', () => {
    render(<GlobalDisasterSummary {...empty} gdacs={alerts} />);
    expect(screen.getByRole('heading', { name: 'Severe flood report' })).toBeInTheDocument();
    const card = screen.getByText('Global disaster alerts').closest('article')!;
    expect(within(card).getByText('2')).toBeInTheDocument();
    expect(screen.queryByText(/Northbank/)).not.toBeInTheDocument();
    expect(screen.queryByText('Available vehicles')).not.toBeInTheDocument();
  });
  it('shows unavailable feeds as unavailable rather than zero disasters', () => {
    render(<GlobalDisasterSummary {...empty} />);
    expect(screen.getByRole('heading', { name: 'Worldwide disaster feeds unavailable' })).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(5);
  });
  it('labels retained data when a refresh fails', () => {
    render(<GlobalDisasterSummary {...empty} gdacs={alerts} failedSources={['GDACS']} />);
    expect(screen.getByText('Refresh failed · showing last successful data')).toBeInTheDocument();
  });
});
