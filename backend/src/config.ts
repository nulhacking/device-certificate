export const PRODUCTION_DOMAIN = 'device-certificate-production.up.railway.app';

function isLocalhostValue(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
}

export function isProduction() {
  return (
    process.env.NODE_ENV === 'production' ||
    !!process.env.RAILWAY_ENVIRONMENT ||
    !!process.env.RAILWAY_PUBLIC_DOMAIN ||
    !!process.env.RAILWAY_STATIC_URL
  );
}

export function getRailwayDomain() {
  const fromEnv = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (fromEnv) {
    return fromEnv.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  const staticUrl = process.env.RAILWAY_STATIC_URL?.trim();
  if (staticUrl) {
    return staticUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  if (isProduction()) {
    return PRODUCTION_DOMAIN;
  }

  return null;
}

function resolveProductionOrigin() {
  const domain = getRailwayDomain();
  return domain ? `https://${domain}` : 'http://localhost:5173';
}

function resolveProductionRpId() {
  return getRailwayDomain() ?? 'localhost';
}

export function getAppOrigin() {
  const configured = process.env.ORIGIN?.trim();

  if (configured && !(isProduction() && isLocalhostValue(configured))) {
    return configured.replace(/\/$/, '');
  }

  if (isProduction()) {
    return resolveProductionOrigin();
  }

  return 'http://localhost:5173';
}

export function getRpId() {
  const configured = process.env.RP_ID?.trim();

  if (configured && !(isProduction() && isLocalhostValue(configured))) {
    return configured.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  if (isProduction()) {
    return resolveProductionRpId();
  }

  return 'localhost';
}

export function getCorsOrigin() {
  const configured = process.env.CORS_ORIGIN?.trim();

  if (configured && !(isProduction() && isLocalhostValue(configured))) {
    return configured.replace(/\/$/, '');
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

export function getPublicConfig() {
  const webauthn = getWebAuthnConfig();
  return {
    origin: webauthn.origin,
    rpID: webauthn.rpID,
    rpName: webauthn.rpName,
    domain: getRailwayDomain(),
    production: isProduction()
  };
}
