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
    expect(screen.getByRole('status')).toHaveTextContent('Worldwide disaster feeds unavailable');
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.getAllByRole('heading', { name: 'No additional report available' })).toHaveLength(4);
  });
  it('labels retained data when a refresh fails', () => {
    render(<GlobalDisasterSummary {...empty} gdacs={alerts} failedSources={['GDACS']} />);
    expect(screen.getByText('Refresh failed · showing last successful data')).toBeInTheDocument();
  });

  it('shows four distinct priority reports with severe alerts first', () => {
    const base = alerts.events[0];
    const events: GdacsEvents['events'] = [
      { ...base, id: 'green', title: 'Green report' },
      { ...base, id: 'red', title: 'Red report', alertLevel: 'red' },
      { ...base, id: 'orange1', title: 'Orange one', alertLevel: 'orange' },
      { ...base, id: 'orange2', title: 'Orange two', alertLevel: 'orange' },
      { ...base, id: 'duplicate', title: 'Red report', alertLevel: 'red' },
      { ...base, id: 'other', title: 'Unranked report', alertLevel: 'unknown' },
    ];
    render(<GlobalDisasterSummary {...empty} gdacs={{ ...alerts, events }} />);
    const cards = within(screen.getByLabelText('Four priority disaster reports')).getAllByRole('article');
    expect(cards).toHaveLength(4);
    expect(within(cards[0]).getByRole('heading')).toHaveTextContent('Red report');
    expect(screen.getAllByRole('heading', { name: 'Red report' })).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Unranked report' })).not.toBeInTheDocument();
  });

  it('features different hazard types when several high-priority droughts are present', () => {
    const base = alerts.events[0];
    const events: GdacsEvents['events'] = [1, 2, 3, 4].map((id) => ({ ...base, id: String(id), title: `Drought ${id}`, eventType: 'DR', alertLevel: 'orange' }));
    events.push({ ...base, id: 'flood', title: 'Flood report', eventType: 'FL' }, { ...base, id: 'storm', title: 'Cyclone report', eventType: 'TC' }, { ...base, id: 'quake', title: 'Earthquake report', eventType: 'EQ' });
    render(<GlobalDisasterSummary {...empty} gdacs={{ ...alerts, events }} />);
    const cards = within(screen.getByLabelText('Four priority disaster reports')).getAllByRole('article');
    expect(cards).toHaveLength(4);
    expect(screen.getByRole('heading', { name: 'Flood report' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cyclone report' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Earthquake report' })).toBeInTheDocument();
  });
});
