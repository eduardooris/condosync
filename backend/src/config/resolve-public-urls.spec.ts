import { resolvePublicUrls } from './resolve-public-urls';

describe('resolvePublicUrls', () => {
  it('usa PUBLIC_URL para app e api em produção', () => {
    const r = resolvePublicUrls({
      PUBLIC_URL: 'https://condosync.duckdns.org',
      NODE_ENV: 'production',
    });
    expect(r.appPublicUrl).toBe('https://condosync.duckdns.org');
    expect(r.apiPublicUrl).toBe('https://condosync.duckdns.org');
  });

  it('em dev mantém API em :3000 quando só APP_PUBLIC_URL está definida', () => {
    const r = resolvePublicUrls({
      APP_PUBLIC_URL: 'http://localhost:5173',
      NODE_ENV: 'development',
    });
    expect(r.appPublicUrl).toBe('http://localhost:5173');
    expect(r.apiPublicUrl).toBe('http://localhost:3000');
  });

  it('em produção espelha APP_PUBLIC_URL na API se PUBLIC_URL ausente', () => {
    const r = resolvePublicUrls({
      APP_PUBLIC_URL: 'https://condosync.duckdns.org',
      NODE_ENV: 'production',
    });
    expect(r.apiPublicUrl).toBe('https://condosync.duckdns.org');
  });
});
