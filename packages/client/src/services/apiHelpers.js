import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@worldplay/shared';

let _logout = null;

export const setUnauthorizedHandler = (fn) => {
  _logout = fn;
};

export class UnauthorizedError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'UnauthorizedError';
  }
}

export async function handleResponse(response) {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (response.ok) {
    return isJson ? response.json() : response.text();
  }

  const body = isJson ? await response.json().catch(() => ({})) : {};
  throw new Error(body.error || body.message || `Error ${response.status}`);
}

export async function apiFetch(url, options = {}) {
  const token = await AsyncStorage.getItem('userToken');

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 401) {
    if (__DEV__ && !_logout) {
      logger.warn('apiHelpers: logout handler not set');
    }
    await _logout?.();
    throw new UnauthorizedError();
  }

  return handleResponse(response);
}
