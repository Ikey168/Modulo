import type { StateStore } from 'oidc-client-ts';
import type { DeviceDocuments } from '../../services/deviceDocuments';

/**
 * PKCE transaction state (state, nonce, code verifier) for the native login.
 * Android may kill the app while the Custom Tab is open, so the transaction
 * lives in app-private device storage until the callback consumes it rather
 * than in memory. Entries are removed when used; nothing here is a token.
 */
export class DeviceOidcStateStore implements StateStore {
  private readonly prefix = 'oidc.transaction:';
  constructor(private readonly documents: DeviceDocuments) {}
  private index(): Promise<string[]> { return this.documents.get<string[]>(`${this.prefix}index`).then(value => value ?? []); }

  async set(key: string, value: string): Promise<void> {
    await this.documents.set(this.prefix + key, value);
    const keys = await this.index();
    if (!keys.includes(key)) await this.documents.set(`${this.prefix}index`, [...keys, key]);
  }
  async get(key: string): Promise<string | null> {
    return (await this.documents.get<string>(this.prefix + key)) ?? null;
  }
  async remove(key: string): Promise<string | null> {
    const value = await this.get(key);
    await this.documents.remove(this.prefix + key);
    await this.documents.set(`${this.prefix}index`, (await this.index()).filter(item => item !== key));
    return value;
  }
  getAllKeys(): Promise<string[]> { return this.index(); }
}
