import { handleResponse } from './apiHelpers';
import { API_BASE_URL } from './apiConfig';

const BASE_URL = API_BASE_URL;
const PUBLIC_FEED_401_MESSAGE = 'Public feed access denied';

export const feedApi = {
  async getPublicFeed({ page = 1, limit = 10 } = {}) {
    const response = await fetch(
      `${BASE_URL}/api/feed/public?page=${page}&limit=${limit}`
    );

    // הערה: getPublicFeed משתמש ב-fetch רגיל (לא apiFetch), ולכן 401 כאן
    // לעולם לא מגיע ל-_logout — הזורק היחיד יושב בתוך apiFetch.
    // ה-guard הבא לא "מונע logout"; הוא רק מחליף את הודעת השגיאה
    // הגנרית של handleResponse בהודעה ספציפית וברורה יותר לפיד הציבורי.
    if (response.status === 401) {
      throw new Error(PUBLIC_FEED_401_MESSAGE);
    }

    return handleResponse(response);
  },
};
