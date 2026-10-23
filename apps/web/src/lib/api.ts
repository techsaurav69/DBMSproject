export type ApiError = {
  errorCode?: string;
  message?: string | string[];
  statusCode?: number;
};

export type CurrentUser = {
  displayName: string;
  email: string;
  id: string;
  roles: string[];
};

export type AuthResponse = {
  accessToken: string;
  user: CurrentUser;
};

export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { displayName: string };

export type OperationsOverview = {
  generatedAt: string;
  activeDisaster: { id: string; name: string; status: string } | null;
  incidents: Array<{ id: string; description: string; emergencyType: string; label: string | null; latitude: number; longitude: number; reportedAt: string; severity: string; status: string }>;
  requests: Array<{ id: string; category: string; description: string; emergencyType: string; isSos: boolean; label: string | null; peopleCount: number | null; severity: string; status: string }>;
  resources: Array<{ id: string; latitude: number; longitude: number; providerName: string; registrationCode: string; status: string; vehicleType: string }>;
  summary: { activeAssignments: number; availableShelterSpaces: number; availableSupplyUnits: number; availableVehicles: number; openIncidents: number; openRequests: number };
};

export type AdvisoryWeather = { advisory: true; fetchedAt: string; locationLabel: string; source: 'Open-Meteo'; precipitationMm: number; riskLevel: 'low' | 'medium' | 'high'; riskSummary: string; temperatureC: number; weatherCode: number; windKph: number };
export type AdvisoryEarthquakes = { advisory: true; events: Array<{ id: string; latitude: number | null; longitude: number | null; magnitude: number | null; place: string; time: string; url: string }>; fetchedAt: string; source: 'USGS' };
export type OsirisHazards = { advisory: true; events: Array<{ kind: 'earthquake' | 'fire' | 'weather'; latitude: number; longitude: number; severity: string; sourceUrl: string | null; summary: string; time: string | null }>; fetchedAt: string; source: 'OSIRIS Intelligence'; stats: { fires: number; incidents: number; weather: number } };
export type CoordinationCandidates = {
  request: { id: string; label: string | null; status: string; urgency: string };
  radiusMeters: number;
  vehicles: Array<{ distanceMetres: number; id: string; providerName: string; registrationCode: string; vehicleType: string }>;
  inventory: Array<{ availableQuantity: number; id: string; providerName: string; resourceName: string; unit: string }>;
  shelters: Array<{ availableSpaces: number; id: string; name: string; providerName: string | null }>;
};
export type SupplyTracking = { assignments: Array<{ assignmentId: string; currentLatitude: number; currentLongitude: number; destinationLabel: string | null; destinationLatitude: number; destinationLongitude: number; etaMinutes: number; originLatitude: number; originLongitude: number; progress: number; providerName: string; registrationCode: string; status: string; supplies: string; vehicleType: string }> };
export type NasaNaturalEvents = { advisory: true; events: Array<{ category: string; id: string; latitude: number | null; longitude: number | null; sourceUrl: string; time: string | null; title: string }>; fetchedAt: string; source: 'NASA EONET' };
export type GdacsEvents = { advisory: true; events: Array<{ alertLevel: 'green' | 'orange' | 'red' | 'unknown'; eventType: string; id: string; latitude: number | null; longitude: number | null; sourceUrl: string; time: string | null; title: string }>; fetchedAt: string; source: 'GDACS' };
export type NotificationItem = { id: string; kind: 'assignment' | 'inventory' | 'request' | 'sos'; message: string; read: boolean; severity: 'critical' | 'high' | 'medium'; timestamp: string; title: string };
export type CreateIncidentInput = { addressText?: string; description: string; emergencyType: string; latitude: number; locationLabel: string; longitude: number; severity: string };
export type CreateRequestInput = { category: string; description: string; incidentId: string; peopleCount?: number; urgency: string };
export type CreateSosInput = { addressText?: string; category: string; description: string; emergencyType: string; latitude: number; locationLabel: string; longitude: number; peopleCount?: number; severity: string };
export type IncidentMessage = { authorName: string; body: string; createdAt: string; id: string; mine: boolean };
export type GlobalChatMessage = IncidentMessage & { roleLabel: string };
export type CoordinatorUpdateScope = 'workflow' | 'request_queue' | 'dispatch' | 'supply_tracking';
export type CoordinatorUpdate = { authorName: string; body: string; createdAt: string; id: string; repeatCount: number; scope: CoordinatorUpdateScope };
export type CommunityGroup = { createdAt: string; creatorName: string; focusArea: string; id: string; joined: boolean; memberCount: number; name: string; pledgeCount: number; summary: string };
export type CommunityPledge = { contributorName: string; createdAt: string; details: string; groupId: string; groupName: string; id: string; kind: string; quantity: number; unitLabel: string };
export type CommunityOverview = { groups: CommunityGroup[]; pledges: CommunityPledge[] };
export type CreateCommunityGroupInput = { focusArea: string; name: string; summary: string };
export type CreateCommunityPledgeInput = { contributionKind: string; details: string; quantity: number; unitLabel: string };

export class ApiRequestError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ApiError;
    const message = Array.isArray(error.message) ? error.message.join('. ') : error.message;
    throw new ApiRequestError(message ?? `Request failed with status ${response.status}.`, response.status);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ database: string; service: string; status: string }>('/health'),
  login: (input: LoginInput) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  me: (accessToken: string) => request<CurrentUser>('/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } }),
  register: (input: RegisterInput) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  operationsOverview: (accessToken: string) => request<OperationsOverview>('/dashboard/overview', { headers: { Authorization: `Bearer ${accessToken}` } }),
  advisoryWeather: (accessToken: string) => request<AdvisoryWeather>('/integrations/weather', { headers: { Authorization: `Bearer ${accessToken}` } }),
  advisoryEarthquakes: (accessToken: string) => request<AdvisoryEarthquakes>('/integrations/earthquakes', { headers: { Authorization: `Bearer ${accessToken}` } }),
  osirisHazards: (accessToken: string) => request<OsirisHazards>('/integrations/osiris-hazards', { headers: { Authorization: `Bearer ${accessToken}` } }),
  nasaNaturalEvents: (accessToken: string) => request<NasaNaturalEvents>('/integrations/nasa-natural-events', { headers: { Authorization: `Bearer ${accessToken}` } }),
  gdacsEvents: (accessToken: string) => request<GdacsEvents>('/integrations/gdacs-events', { headers: { Authorization: `Bearer ${accessToken}` } }),
  notifications: (accessToken: string) => request<{ items: NotificationItem[]; unreadCount: number }>('/notifications', { headers: { Authorization: `Bearer ${accessToken}` } }),
  markNotificationRead: (accessToken: string, id: string) => request<{ ok: true }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } }),
  markAllNotificationsRead: (accessToken: string) => request<{ ok: true }>('/notifications/read-all', { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } }),
  coordinationCandidates: (accessToken: string, requestId: string, radiusMeters: number) => request<CoordinationCandidates>(`/coordination/requests/${requestId}/candidates?radiusMeters=${radiusMeters}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
  dispatchVehicle: (accessToken: string, requestId: string, vehicleId: string) => request<{ assignmentId: string; requestStatus: string }>('/coordination/dispatches', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ requestId, vehicleId }) }),
  reserveInventory: (accessToken: string, requestId: string, inventoryId: string, quantity: number) => request<{ allocationId: string; availableQuantity: number }>('/coordination/inventory-reservations', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ requestId, inventoryId, quantity }) }),
  reserveShelter: (accessToken: string, requestId: string, shelterId: string, peopleCount: number) => request<{ reservationId: string; availableSpaces: number }>('/coordination/shelter-reservations', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ requestId, shelterId, peopleCount }) }),
  supplyTracking: (accessToken: string) => request<SupplyTracking>('/coordination/supply-tracking', { headers: { Authorization: `Bearer ${accessToken}` } }),
  updateAssignmentStatus: (accessToken: string, assignmentId: string, status: string) => request<{ status: string }>(`/coordination/assignments/${assignmentId}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ status }) }),
  createIncident: (accessToken: string, input: CreateIncidentInput) => request<OperationsOverview['incidents'][number]>('/incidents', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(input) }),
  createRequest: (accessToken: string, input: CreateRequestInput) => request<{ id: string; status: string }>('/requests', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(input) }),
  createSos: (accessToken: string, input: CreateSosInput) => request<{ incidentId: string; requestId: string; status: string }>('/sos', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(input) }),
  incidentMessages: (accessToken: string, incidentId: string) => request<{ items: IncidentMessage[] }>(`/incidents/${incidentId}/messages`, { headers: { Authorization: `Bearer ${accessToken}` } }),
  createIncidentMessage: (accessToken: string, incidentId: string, body: string) => request<IncidentMessage>(`/incidents/${incidentId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ body }) }),
  globalChatMessages: (accessToken: string) => request<{ items: GlobalChatMessage[] }>('/chat/global', { headers: { Authorization: `Bearer ${accessToken}` } }),
  createGlobalChatMessage: (accessToken: string, body: string) => request<GlobalChatMessage>('/chat/global', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ body }) }),
  clearGlobalChatMessages: (accessToken: string) => request<{ deleted: number }>('/chat/global', { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }),
  coordinatorUpdates: (accessToken: string, scope: CoordinatorUpdateScope) => request<{ items: CoordinatorUpdate[] }>(`/coordinator-updates/${scope}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
  createCoordinatorUpdate: (accessToken: string, scope: CoordinatorUpdateScope, body: string) => request<CoordinatorUpdate>(`/coordinator-updates/${scope}`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ body }) }),
  communityOverview: (accessToken: string) => request<CommunityOverview>('/community/overview', { headers: { Authorization: `Bearer ${accessToken}` } }),
  createCommunityGroup: (accessToken: string, input: CreateCommunityGroupInput) => request<CommunityGroup>('/community/groups', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(input) }),
  joinCommunityGroup: (accessToken: string, id: string) => request<{ joined: boolean }>(`/community/groups/${id}/join`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }),
  createCommunityPledge: (accessToken: string, groupId: string, input: CreateCommunityPledgeInput) => request<CommunityPledge>(`/community/groups/${groupId}/pledges`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(input) }),
  updateRequestStatus: (accessToken: string, id: string, status: string) => request<{ id: string; status: string }>(`/requests/${id}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ status }) }),
};
