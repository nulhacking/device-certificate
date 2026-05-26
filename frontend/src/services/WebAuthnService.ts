import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser';

export async function registerDeviceCredential(options: PublicKeyCredentialCreationOptionsJSON) {
  return startRegistration({ optionsJSON: options });
}

export async function authenticateDeviceCredential(options: PublicKeyCredentialRequestOptionsJSON) {
  return startAuthentication({ optionsJSON: options });
}

export function isWebAuthnSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}
