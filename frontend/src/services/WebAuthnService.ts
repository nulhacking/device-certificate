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

export function isMac() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Mac OS X/.test(navigator.userAgent);
}

export function isWindows() {
  if (typeof navigator === 'undefined') return false;
  return /Win/.test(navigator.platform) || /Windows/.test(navigator.userAgent);
}

export function getBiometricLabel() {
  if (isMac()) return 'Touch ID';
  if (isWindows()) return 'Windows Hello';
  return 'Windows Hello / Touch ID / PIN';
}

export function getBiometricDescription() {
  if (isMac()) {
    return 'Mac da Touch ID yoki tizim paroli orqali qurilmani tasdiqlang.';
  }
  if (isWindows()) {
    return 'Windows Hello yoki PIN orqali qurilmani tasdiqlang.';
  }
  return 'Windows Hello, Touch ID yoki PIN orqali qurilmani tasdiqlang.';
}
