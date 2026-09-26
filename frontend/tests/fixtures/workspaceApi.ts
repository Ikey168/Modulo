import { expect, type Page } from '@playwright/test';
import type { StateRecord } from '../../src/services/pluginStateClient';

/** Bounded browser fixture, not a live-authentication or database integration test.
 * Only the identity provider and HTTP responses are substituted. The real
 * workspace, installation validation, state client and persistence still run.
 */
export async function installWorkspaceFixture(page: Page, installed: string[]) {
  const token = 'smoke-test-token';
  await page.route('**/src/features/auth/authService.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      const session = {issuer:'https://identity.example.test',subject:'smoke-owner',accessToken:'${token}'};
      export const authService = {
        stateSession: () => session,
        subscribeSession: () => () => {},
        getAccessToken: async () => session.accessToken,
        getUser: async () => ({id:session.subject,name:'Smoke owner',email:'smoke@example.test',roles:['ADMIN'],accessToken:session.accessToken}),
        isAuthenticated: () => true,
        hasRole: () => true,
        hasAnyRole: () => true
      };
    `,
  }));

  const time = '2026-09-07T00:00:00Z';
  const records = new Map<string, StateRecord>();
  records.set('workspace-settings/installed', {
    key: 'installed', schemaId: 'modulo.workspace.installations', schemaVersion: 1,
    version: 1, value: installed.map(id => ({ id, enabled: true })),
    deleted: false, createdAt: time, updatedAt: time,
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/workflow-runs/summary') {
      await route.fulfill({ json: { counts: [] } });
      return;
    }
    if (url.pathname === '/api/workflow-runs') {
      await route.fulfill({ json: { items: [], hasMore: false } });
      return;
    }
    const match = url.pathname.match(/^\/api\/workspaces\/personal\/plugin-state\/([^/]+)(?:\/([^/]+))?$/);
    if (!match) {
      await route.fulfill({ json: [] });
      return;
    }
    expect(request.headers().authorization).toBe(`Bearer ${token}`);
    const namespace = decodeURIComponent(match[1]);
    const key = match[2] ? decodeURIComponent(match[2]) : undefined;
    if (!key) {
      expect(request.method()).toBe('GET');
      await route.fulfill({ json: {
        records: [...records].filter(([id]) => id.startsWith(`${namespace}/`)).map(([, value]) => value),
        nextCursor: null,
      } });
      return;
    }
    const id = `${namespace}/${key}`;
    const current = records.get(id);
    if (request.method() === 'GET') {
      await route.fulfill(current ? { json: current } : { status: 404, json: { code: 'STATE_NOT_FOUND' } });
      return;
    }
    if (request.method() === 'PUT') {
      const body = request.postDataJSON();
      if (body.expectedVersion !== (current?.version ?? 0)) {
        await route.fulfill({ status: 409, json: { code: 'STATE_VERSION_CONFLICT', current } });
        return;
      }
      const next: StateRecord = {
        key, schemaId: body.schemaId, schemaVersion: body.schemaVersion,
        value: body.value, version: body.expectedVersion + 1, deleted: false,
        createdAt: current?.createdAt ?? time, updatedAt: time,
      };
      records.set(id, next);
      await route.fulfill({ json: next });
      return;
    }
    throw new Error(`Unexpected state request: ${request.method()} ${url.pathname}`);
  });
  return records;
}
