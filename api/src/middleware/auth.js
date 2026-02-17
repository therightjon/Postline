import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const TENANT_NAME = process.env.B2C_TENANT_NAME || 'postlineb2c';
const CLIENT_ID = process.env.B2C_CLIENT_ID;
const POLICY_NAME = process.env.B2C_POLICY_NAME || 'B2C_1_signupsignin';

const jwksUri = `https://${TENANT_NAME}.b2clogin.com/${TENANT_NAME}.onmicrosoft.com/${POLICY_NAME}/discovery/v2.0/keys`;

const client = jwksClient({
  jwksUri,
  cache: true,
  rateLimit: true,
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

/**
 * Validates a B2C access token and returns the decoded user info.
 * Returns null if no valid token is found.
 */
export function authenticateRequest(request) {
  return new Promise((resolve) => {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      resolve(null);
      return;
    }

    jwt.verify(
      token,
      getSigningKey,
      {
        audience: CLIENT_ID,
        issuer: `https://${TENANT_NAME}.b2clogin.com/${TENANT_NAME}.onmicrosoft.com/${POLICY_NAME}/v2.0/`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) {
          console.error('Token validation failed:', err.message);
          resolve(null);
        } else {
          resolve({
            userId: decoded.oid || decoded.sub,
            email: decoded.emails?.[0] || decoded.email || '',
            name: decoded.name || '',
          });
        }
      }
    );
  });
}

/**
 * Middleware helper — returns 401 if not authenticated.
 */
export async function requireAuth(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return {
      status: 401,
      jsonBody: { error: 'Unauthorized. Please sign in.' },
    };
  }
  return user;
}
