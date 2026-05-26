export function isProduction() {
  return (
    process.env.NODE_ENV === 'production' ||
    !!process.env.RAILWAY_ENVIRONMENT ||
    !!process.env.RAILWAY_PUBLIC_DOMAIN
  );
}

export function getAppOrigin() {
  if (process.env.ORIGIN) {
    return process.env.ORIGIN;
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  return 'http://localhost:5173';
}

export function getRpId() {
  if (process.env.RP_ID) {
    return process.env.RP_ID;
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return process.env.RAILWAY_PUBLIC_DOMAIN;
  }

  return 'localhost';
}

export function getCorsOrigin() {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN;
  }

  if (isProduction()) {
    return getAppOrigin();
  }

  return 'http://localhost:5173';
}

export function getWebAuthnConfig() {
  return {
    rpName: process.env.RP_NAME ?? 'Device Certificate Login',
    rpID: getRpId(),
    origin: getAppOrigin()
  };
}
