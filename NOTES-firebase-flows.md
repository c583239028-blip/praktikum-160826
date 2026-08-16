# NOTES-firebase-flows.md

---

## Part 1: Firebase Console & Identity Provider Setup

To successfully activate each provider within the Firebase Console, the following credentials and configurations must be gathered beforehand.

---

### 1. Google Provider Requirements

- **Support Email:** A valid project support email must be configured in the Firebase general settings before enabling Google Sign-In.
- **Authorized Domains:** Ensure your local (`localhost`) and production domains are whitelisted under the Authentication settings.

---

### 2. Facebook Provider Requirements

- **App ID:** The unique public identifier for your Meta application.
- **App Secret:** The private cryptographic secret from the Meta Developer Console.
- **OAuth Redirect URI:** Copy the redirect URL provided by Firebase and paste it into the "Facebook Login" settings on the Meta Developer Portal:

```
https://<project-id>.firebaseapp.com/__/auth/handler
```

---

### 3. Apple Provider Requirements

- **Team ID:** A unique 10-character string assigned to your developer account by Apple.
- **Services ID:** The identifier used to register your web application for Apple Auth (acts as the Client ID).
- **Key ID:** The identifier of the private key generated to sign client requests.
- **Private Key (`.p8` file):** The downloadable cryptographic key used by Firebase to securely communicate with Apple's identity servers.

---

## Part 2: Package Dependencies & Recommended Versions

```json
{
  "dependencies": {
    "firebase": "^10.8.0"
  },
  "devDependencies": {
    "firebase-admin": "^12.0.0",
    "jwt-decode": "^4.0.0"
  }
}
```

**`firebase`** — Core Web SDK providing client-side authentication modules, managing OAuth handshakes, session persistence, and auth state.

**`firebase-admin`** *(devDependency — Server-side only)* — The Firebase Admin SDK, used exclusively in trusted server environments (Node.js / Express). It is never bundled into the client. Its primary role here is to verify incoming ID Tokens via `admin.auth().verifyIdToken(idToken)` — confirming the token's signature, expiry, and project audience — and to extract the decoded user payload for use in protected routes.

**`jwt-decode`** *(optional — debugging only)* — Decodes a JWT payload on the client without verifying its signature. **Not required in production flows:** on the server, `verifyIdToken()` already returns the fully decoded payload; on the client, the token should only be forwarded to the server, never decoded locally. Keep only if you need to inspect token claims (e.g. `exp`, `auth_time`) during local development or debugging.

---

## Part 3: Provider Initialization & Constructor Signatures

### 0. Auth Initialization (Required for All Providers)

Before using any provider, you must initialize the Firebase app and obtain the `auth` instance. All SDK methods in Parts 3 and 4 depend on this object.

```javascript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const app = initializeApp(firebaseConfig); // firebaseConfig = your project's config object
export const auth = getAuth(app);
```

### 1. Google Provider

- **Class:** `GoogleAuthProvider`
- **Constructor Signature:** `new GoogleAuthProvider(): GoogleAuthProvider`

```javascript
import { GoogleAuthProvider } from "firebase/auth";

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.setCustomParameters({ prompt: 'select_account' });
```

---

### 2. Facebook Provider

- **Class:** `FacebookAuthProvider`
- **Constructor Signature:** `new FacebookAuthProvider(): FacebookAuthProvider`

```javascript
import { FacebookAuthProvider } from "firebase/auth";

const provider = new FacebookAuthProvider();
provider.addScope('email');
```

---

### 3. Apple Provider

- **Class:** `OAuthProvider`
- **Constructor Signature:** `new OAuthProvider(providerId: string): OAuthProvider`
- **Note:** Must pass the literal string `'apple.com'` as the provider ID.

```javascript
import { OAuthProvider } from "firebase/auth";

const provider = new OAuthProvider('apple.com');
provider.addScope('email');
provider.addScope('name');
```

---

## Part 4: Core Authentication Execution Signatures (Web SDK)

Regardless of which provider was initialized in Part 3, Firebase's Modular API executes authentication using the following SDK methods.

---

### 1. Popup Flow

- **Method:** `signInWithPopup`
- **Signature:** `signInWithPopup(auth: Auth, provider: AuthProvider): Promise<UserCredential>`

---

### 2. Redirect Flow (Mobile / Strict Browsers)

- **Method:** `signInWithRedirect`
- **Signature:** `signInWithRedirect(auth: Auth, provider: AuthProvider): Promise<void>`

---

### 3. Fetching Redirect Result (On Page Reload)

- **Method:** `getRedirectResult`
- **Signature:** `getRedirectResult(auth: Auth): Promise<UserCredential | null>`

---

### 4. Server-Side Credential (Node.js / Manual Token Exchange)

- **Method:** `signInWithCredential`
- **Signature:** `signInWithCredential(auth: Auth, credential: AuthCredential): Promise<UserCredential>`

---

### ⚠️ Edge Case: Account Collision

If a user attempts to sign in with Apple or Facebook using an email that already exists under a different provider (e.g. Google), Firebase throws:

```
auth/account-exists-with-different-credential
```

**Resolution flow:**

1. Catch the error.
2. Extract the pending credential:
   - `FacebookAuthProvider.credentialFromError(error)`
   - `OAuthProvider.credentialFromError(error)`
3. Sign the user in with their original provider.
4. Call `linkWithCredential(user, pendingCredential)` to merge the accounts.

---

## Part 5: Token Management & Production Integration

### What `getIdToken()` Returns

The `getIdToken(forceRefresh?: boolean)` method is exposed by the Firebase `User` object. It returns a `Promise<string>` that resolves to a cryptographic, Base64-encoded JWT string signed by Firebase servers.

> **Token expiry: strictly 60 minutes.** Firebase auto-refreshes it on the next call after expiry.

The token payload contains the following security claims (visible via `verifyIdToken()` on the server, or via `jwt-decode` for local debugging):

| Claim | Description |
|-------|-------------|
| `iss` | Issuer — proves Firebase generated the token (`https://securetoken.google.com/<project-id>`) |
| `aud` | Audience — your specific Firebase Project ID |
| `sub` | Subject — the unique Firebase User ID (`uid`), used to map data on your backend |
| `email` | The authenticated user's email address |
| `exp` | Expiration time — Unix timestamp indicating when the token becomes invalid |

---

### Production Code Examples

**1. Client-Side Token Extraction Utility**

```javascript
export const getValidAuthToken = async (auth, forceRefresh = false) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return await currentUser.getIdToken(forceRefresh);
};
```

---

**2. Axios Request Interceptor (Injecting Token into Backend Requests)**

```javascript
import axios from 'axios';
import { auth } from './firebaseConfig';

const apiClient = axios.create({
  baseURL: 'https://api.yourdomain.com/v1',
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await getValidAuthToken(auth);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```

---

**3. Server-Side Token Verification Middleware (Node.js / Express)**

```javascript
const admin = require('firebase-admin');

const verifyFirebaseTokenMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token header.' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // Verifies signature, expiration, and project audience via Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Injects decoded payload (including uid) into the request
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired credentials.' });
  }
};

module.exports = verifyFirebaseTokenMiddleware;
```
