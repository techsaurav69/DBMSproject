const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

type Body = Record<string, unknown>;

async function request(path: string, options: RequestInit = {}): Promise<{ body: Body; response: Response }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  return { response, body: await response.json() as Body };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const unauthenticated = await request('/dashboard/overview');
  assert(unauthenticated.response.status === 401, 'Dashboard overview must reject unauthenticated requests.');

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'coordinator.demo@crisisgrid.local', password: 'DemoOnly!ChangeBeforeProduction' }),
  });
  assert(login.response.status === 200 && typeof login.body.accessToken === 'string', 'Coordinator login failed.');
  const headers = { Authorization: `Bearer ${login.body.accessToken}` };

  const overview = await request('/dashboard/overview', { headers });
  assert(overview.response.status === 200, `Dashboard overview returned ${overview.response.status}.`);
  assert(typeof overview.body.summary === 'object' && overview.body.summary !== null, 'Dashboard summary is missing.');
  assert(Array.isArray(overview.body.incidents) && Array.isArray(overview.body.requests) && Array.isArray(overview.body.resources), 'Dashboard operational collections are missing.');
  const firstIncident = (overview.body.incidents as Array<{ id?: string }>)[0];
  assert(typeof firstIncident?.id === 'string', 'Dashboard needs a seeded incident for message verification.');
  const messages = await request(`/incidents/${firstIncident.id}/messages`, { headers });
  assert(messages.response.status === 200 && Array.isArray(messages.body.items), 'Incident messages endpoint did not return a list.');
  const globalChat = await request('/chat/global', { headers });
  assert(globalChat.response.status === 200 && Array.isArray(globalChat.body.items), 'Global chat endpoint did not return a list.');

  const [weather, earthquakes, osirisHazards] = await Promise.all([
    request('/integrations/weather', { headers }),
    request('/integrations/earthquakes', { headers }),
    request('/integrations/osiris-hazards', { headers }),
  ]);
  assert([200, 503].includes(weather.response.status), 'Weather advisory must respond with data or a safe unavailable state.');
  assert([200, 503].includes(earthquakes.response.status), 'Earthquake advisory must respond with data or a safe unavailable state.');
  assert([200, 503].includes(osirisHazards.response.status), 'OSIRIS hazards must respond with data or a safe unavailable state.');
  if (osirisHazards.response.status === 200) assert(typeof osirisHazards.body.stats === 'object', 'OSIRIS hazard response is missing normalized stats.');
  console.log('Phase 4 dashboard smoke checks passed.');
}

void main();
