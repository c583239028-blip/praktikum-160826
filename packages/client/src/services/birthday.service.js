import { apiFetch } from './apiHelpers';

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/users`;

export const birthdayService = {
  hasDateOfBirth: (user) => {
    // בודקת אם למשתמשת יש תאריך לידה שמור
    return !!user?.dateOfBirth;
  },

  shouldShowPopup: (user) => {
    if (!user) return false;
    return !birthdayService.hasDateOfBirth(user);
  },

  saveBirthday: async (dateOfBirth) => {
    return apiFetch(`${API_URL}/me/birthday`, {
      method: 'PATCH',
      body: JSON.stringify({ dateOfBirth }),
    });
  },
};
