import * as jwt from 'jsonwebtoken';
import { JwtHeader } from 'jsonwebtoken';
import jwksClient = require('jwks-rsa');
import { JwksClient } from 'jwks-rsa';

const clientCache: Record<string, JwksClient> = {};

function getClient(jwksUri: string): JwksClient {
  if (!clientCache[jwksUri]) {
    clientCache[jwksUri] = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxEntries: 10,
      cacheMaxAge: 10 * 60 * 1000,
      timeout: 10000,
    });
  }
  return clientCache[jwksUri];
}

function getSigningKey(jwksUri: string, kid: string): Promise<string> {
  const client = getClient(jwksUri);
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err || !key) {
        reject(err ?? new Error('Signing key not found'));
        return;
      }
      resolve(key.getPublicKey());
    });
  });
}

export async function verifyJwtWithJwks(params: {
  token: string;
  jwksUri: string;
  issuer: string;
  audience?: string;
}): Promise<Record<string, unknown>> {
  const decoded = jwt.decode(params.token, { complete: true });
  const header = decoded && typeof decoded === 'object' ? decoded.header : null;
  const kid = (header as JwtHeader | null)?.kid;
  if (!kid) {
    throw new Error('Missing kid in token header');
  }
  const publicKey = await getSigningKey(params.jwksUri, kid);
  return new Promise((resolve, reject) => {
    jwt.verify(
      params.token,
      publicKey,
      {
        algorithms: ['RS256'],
        issuer: params.issuer,
        audience: params.audience,
      },
      (err, payload) => {
        if (err || !payload || typeof payload === 'string') {
          reject(err ?? new Error('Invalid token payload'));
          return;
        }
        resolve(payload as Record<string, unknown>);
      },
    );
  });
}
