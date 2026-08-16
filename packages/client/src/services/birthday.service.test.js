/* eslint-env jest */
import { birthdayService } from './birthday.service';
import { authService } from './auth.service';

jest.mock('./auth.service', () => ({
  authService: { getToken: jest.fn().mockResolvedValue('my-token') },
}));

beforeEach(() => jest.clearAllMocks());

test('hasDateOfBirth מחזירה לפי קיום תאריך', () => {
  expect(birthdayService.hasDateOfBirth({ dateOfBirth: '1995-06-15' })).toBe(
    true
  );
  expect(birthdayService.hasDateOfBirth({})).toBe(false);
  expect(birthdayService.hasDateOfBirth(null)).toBe(false);
});

test('shouldShowPopup מחזירה true כשאין תאריך לידה', () => {
  expect(birthdayService.shouldShowPopup({})).toBe(true);
  expect(birthdayService.shouldShowPopup({ dateOfBirth: '1995-06-15' })).toBe(
    false
  );
});

test('saveBirthday שולחת PATCH עם token ושדה dateOfBirth', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({ id: 'user-1', dateOfBirth: '1995-06-15' }),
  });

  await birthdayService.saveBirthday('1995-06-15');

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/users/me/birthday'),
    expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
      body: JSON.stringify({ dateOfBirth: '1995-06-15' }),
    })
  );
});

test('saveBirthday זורקת שגיאה כשהשרת מחזיר !ok', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    headers: { get: () => 'application/json' },
    json: async () => ({ message: 'Failed to save birthday' }),
  });

  await expect(birthdayService.saveBirthday('1995-06-15')).rejects.toThrow(
    'Failed to save birthday'
  );
});
