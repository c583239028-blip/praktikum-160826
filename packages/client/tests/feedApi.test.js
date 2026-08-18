import { feedApi } from '../src/services/feedApi';

// מדמים את handleResponse מ-apiHelpers
jest.mock('../src/services/apiHelpers', () => ({
  handleResponse: jest.fn(),
}));

import { handleResponse } from '../src/services/apiHelpers';

beforeEach(() => {
  jest.clearAllMocks();
});

// ✅ קריטריון 1: 401 לא מנתק — זורק שגיאה רגילה בלבד
test('401 בפיד ציבורי — זורק שגיאה רגילה ולא קורא handleResponse', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 401,
    headers: { get: () => null },
  });

  await expect(feedApi.getPublicFeed()).rejects.toThrow(
    'Public feed access denied'
  );

  // getPublicFeed משתמש ב-fetch רגיל ולא ב-apiFetch — ולכן _logout
  // לעולם לא מופעל, ללא קשר אם handleResponse נקרא או לא.
  // הבדיקה הזו רק מוודאת שהזרימה עוצרת לפני handleResponse כצפוי.
  expect(handleResponse).not.toHaveBeenCalled();
});

// ✅ קריטריון 2: תשובה תקינה עוברת ל-handleResponse
test('200 — מעביר את התשובה ל-handleResponse', async () => {
  const mockResponse = {
    status: 200,
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({ posts: [] }),
  };

  global.fetch = jest.fn().mockResolvedValue(mockResponse);
  handleResponse.mockResolvedValue({ posts: [] });

  const result = await feedApi.getPublicFeed();

  expect(handleResponse).toHaveBeenCalledWith(mockResponse);
  expect(result).toEqual({ posts: [] });
});

// ✅ קריטריון 3: pagination — page ו-limit עוברים ב-URL
test('שולח page ו-limit נכונים ב-URL', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({}),
  });
  handleResponse.mockResolvedValue({});

  await feedApi.getPublicFeed({ page: 3, limit: 20 });

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('page=3&limit=20')
  );
});
