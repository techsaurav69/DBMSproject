import { useEffect, useState } from 'react';
import { ApiRequestError, api, type CoordinationCandidates, type OperationsOverview } from '../lib/api';

type Request = OperationsOverview['requests'][number];
type Props = { accessToken: string; onChanged: () => void; requests: Request[] };

function titleCase(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function DispatchPlanner({ accessToken, onChanged, requests }: Props): React.ReactElement {
  const [requestId, setRequestId] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(5000);
  const [candidates, setCandidates] = useState<CoordinationCandidates | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [peopleCount, setPeopleCount] = useState(1);

  useEffect(() => {
    const suitable = requests.find((request) => request.status === 'triaged') ?? requests[0];
    if (!requestId || !requests.some((request) => request.id === requestId)) setRequestId(suitable?.id ?? '');
  }, [requestId, requests]);

  useEffect(() => {
    if (!requestId) { setCandidates(null); return; }
    let active = true;
    setMessage(null);
    void api.coordinationCandidates(accessToken, requestId, radiusMeters)
      .then((result) => { if (active) { setCandidates(result); setPeopleCount(Math.max(1, requests.find((request) => request.id === requestId)?.peopleCount ?? 1)); } })
      .catch((reason: unknown) => { if (active) setMessage(reason instanceof ApiRequestError ? reason.message : 'Unable to find eligible resources.'); });
    return () => { active = false; };
  }, [accessToken, radiusMeters, requestId, requests]);

  const selected = requests.find((request) => request.id === requestId);
  const canDispatch = candidates?.request.status === 'triaged';
  const canReserve = ['triaged', 'assigned', 'in_progress'].includes(candidates?.request.status ?? '');

  async function act(key: string, action: () => Promise<unknown>): Promise<void> {
    setBusy(key); setMessage(null);
    try { await action(); setMessage('Action recorded in the local audit trail.'); onChanged(); }
    catch (reason: unknown) { setMessage(reason instanceof ApiRequestError ? reason.message : 'The coordination action could not be saved.'); }
    finally { setBusy(null); }
  }

  return <section id="dispatch" className="dispatch-planner" aria-labelledby="dispatch-title">
    <header className="dispatch-planner__header"><div><p className="eyebrow">COORDINATION WORKBENCH</p><h2 id="dispatch-title">Dispatch and resource planner</h2><p>Find nearby verified vehicles with PostGIS, then reserve supplies or shelter capacity through row-locked local transactions.</p></div><span className="data-chip">LOCAL DB · SAFE ACTIONS</span></header>
    {!requests.length ? <div className="dispatch-planner__empty"><strong>No open requests to coordinate.</strong><span>Create or retain an assistance request to use the planner.</span></div> : <>
      <div className="dispatch-controls"><label>Request<select value={requestId} onChange={(event) => setRequestId(event.target.value)}>{requests.map((request) => <option key={request.id} value={request.id}>{titleCase(request.category)} · {request.label ?? 'Location pending'} · {titleCase(request.status)}</option>)}</select></label><label>Search radius<select value={radiusMeters} onChange={(event) => setRadiusMeters(Number(event.target.value))}><option value={1000}>1 km</option><option value={5000}>5 km</option><option value={10000}>10 km</option><option value={25000}>25 km</option></select></label><div className={`dispatch-stage dispatch-stage--${selected?.status ?? 'open'}`}><span>Current stage</span><strong>{titleCase(selected?.status ?? 'open')}</strong></div></div>
      {selected?.status === 'open' && <div className="dispatch-planner__notice"><strong>Triage required.</strong> Mark this request triaged in the request queue before assigning a vehicle. You can still review candidates now.</div>}
      {message && <div className={message.startsWith('Action recorded') ? 'dispatch-planner__success' : 'dispatch-planner__error'}>{message}</div>}
      <div className="dispatch-workspace"><article><header><span className="workbench-icon">↗</span><div><p>NEARBY FLEET</p><h3>Verified vehicles</h3></div></header><small>Distances are straight-line metres, not travel times.</small><div className="candidate-list">{candidates?.vehicles.length ? candidates.vehicles.map((vehicle) => <div key={vehicle.id}><span><strong>{vehicle.registrationCode}</strong><small>{titleCase(vehicle.vehicleType)} · {vehicle.providerName}</small></span><b>{vehicle.distanceMetres.toLocaleString()} m</b><button type="button" disabled={!canDispatch || busy !== null} onClick={() => void act(`vehicle-${vehicle.id}`, () => api.dispatchVehicle(accessToken, requestId, vehicle.id))}>{busy === `vehicle-${vehicle.id}` ? 'Dispatching…' : 'Dispatch vehicle'}</button></div>) : <p className="candidate-empty">No eligible verified vehicles inside this radius.</p>}</div></article><article><header><span className="workbench-icon">▣</span><div><p>INVENTORY</p><h3>Reserve supplies</h3></div></header><small>Reservation increments the protected inventory counter.</small><label className="amount-control">Units<input min="1" max="100000" type="number" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></label><div className="candidate-list">{candidates?.inventory.length ? candidates.inventory.map((item) => <div key={item.id}><span><strong>{item.resourceName}</strong><small>{item.availableQuantity.toLocaleString()} {item.unit} · {item.providerName}</small></span><button type="button" disabled={!canReserve || busy !== null} onClick={() => void act(`inventory-${item.id}`, () => api.reserveInventory(accessToken, requestId, item.id, quantity))}>{busy === `inventory-${item.id}` ? 'Reserving…' : 'Reserve'}</button></div>) : <p className="candidate-empty">No unreserved supply inventory is available.</p>}</div></article><article><header><span className="workbench-icon">⌂</span><div><p>SHELTER</p><h3>Reserve capacity</h3></div></header><small>Capacity is checked and held inside the same transaction.</small><label className="amount-control">People<input min="1" max="100000" type="number" value={peopleCount} onChange={(event) => setPeopleCount(Math.max(1, Number(event.target.value)))} /></label><div className="candidate-list">{candidates?.shelters.length ? candidates.shelters.map((shelter) => <div key={shelter.id}><span><strong>{shelter.name}</strong><small>{shelter.availableSpaces.toLocaleString()} spaces · {shelter.providerName ?? 'Local operator'}</small></span><button type="button" disabled={!canReserve || busy !== null} onClick={() => void act(`shelter-${shelter.id}`, () => api.reserveShelter(accessToken, requestId, shelter.id, peopleCount))}>{busy === `shelter-${shelter.id}` ? 'Reserving…' : 'Reserve'}</button></div>) : <p className="candidate-empty">No operational shelter capacity is available.</p>}</div></article></div>
    </>}
  </section>;
}
