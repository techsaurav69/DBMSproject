const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

type ResponseBody = Record<string, unknown>;

async function request(path: string, options: RequestInit = {}): Promise<{ body: ResponseBody; response: Response }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  return { response, body: await response.json() as ResponseBody };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function login(email: string): Promise<string> {
  const { response, body } = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'DemoOnly!ChangeBeforeProduction' }),
  });
  assert(response.status === 200, `Expected successful login for ${email}; got ${response.status}.`);
  assert(typeof body.accessToken === 'string', 'Login response did not contain an access token.');
  return body.accessToken;
}

async function main(): Promise<void> {
  const health = await request('/health');
  assert(health.response.status === 200 && health.body.status === 'ok', 'Health endpoint did not return OK.');

  const coordinatorToken = await login('coordinator.demo@crisisgrid.local');
  const unauthenticated = await request('/auth/me');
  assert(unauthenticated.response.status === 401, 'Unauthenticated /auth/me should return 401.');

  const profile = await request('/auth/me', { headers: { Authorization: `Bearer ${coordinatorToken}` } });
  assert(
    profile.response.status === 200 && Array.isArray(profile.body.roles),
    `Authenticated /auth/me did not return a profile (status ${profile.response.status}): ${JSON.stringify(profile.body)}`,
  );

  const forbiddenUsers = await request('/users', { headers: { Authorization: `Bearer ${coordinatorToken}` } });
  assert(forbiddenUsers.response.status === 403, 'Coordinator access to /users should return 403.');

  const adminToken = await login('admin.demo@crisisgrid.local');
  const users = await request('/users', { headers: { Authorization: `Bearer ${adminToken}` } });
  assert(users.response.status === 200 && Array.isArray(users.body), 'Administrator /users should return a user list.');
  assert(!JSON.stringify(users.body).includes('password_hash'), 'User endpoint exposed a password hash.');

  const invalidCredentials = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: "' OR '1'='1", password: 'incorrect-password' }),
  });
  assert(
    [400, 401].includes(invalidCredentials.response.status) && typeof invalidCredentials.body.accessToken !== 'string',
    'Injection-like credentials must be rejected without issuing a token.',
  );
  console.log('Phase 3 authentication smoke checks passed.');
}

void main();
