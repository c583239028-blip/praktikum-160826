import { apiFetch } from './apiHelpers';
import { API_BASE_URL } from './apiConfig';

const BASE_URL = API_BASE_URL;

export const userService = {
  getMe: async () => {
    return apiFetch(`${BASE_URL}/api/users/me`);
  },

  updateBirthday: async (dateOfBirth) => {
    return apiFetch(`${BASE_URL}/api/users/me/birthday`, {
      method: 'PATCH',
      body: JSON.stringify({ dateOfBirth }),
    });
  },
};
