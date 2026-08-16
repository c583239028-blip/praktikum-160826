// packages/shared/src/constants/errors.js

export const ERROR_MESSAGES = {
  // ── AUTH & PERMISSIONS ───────────────────────────────────────────────
  JWT_SECRET_REQUIRED: 'JWT_SECRET environment variable is required',
  FIREBASE_TOKEN_REQUIRED: 'Firebase token is required',
  INVALID_FIREBASE_TOKEN: 'Invalid or expired Firebase token',
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password',
  EMAIL_ALREADY_REGISTERED: 'Email address is already registered',
  ACCOUNT_INACTIVE:
    'Your account is blocked or inactive. Please contact support.',
  SIGN_IN_WITH_SOCIAL: 'Please sign in with your social account',
  NOT_AUTHORIZED_USER_NOT_FOUND: 'Not authorized: User not found',
  AUTHENTICATION_ERROR: 'Authentication error',
  SERVER_ERROR_REGISTRATION: 'Server error during registration',
  SERVER_ERROR_LOGIN: 'Server error during login',
  UNAUTHORIZED: 'Unauthorized',

  // ── GENERAL VALIDATIONS ──────────────────────────────────────────────
  USER_ID_REQUIRED: 'User ID is required',
  USER_NOT_FOUND: 'User not found',
  MISSING_USER_IDS: 'Missing user IDs',
  MISSING_REQUIRED_FIELDS: 'Missing required fields',
  NOTIFICATION_NOT_FOUND: 'Notification not found',
  TARGET_USER_ID_REQUIRED: 'targetUserId is required',
  INVALID_DATA_FORMAT: 'Invalid data format',

  // ── MODERATION ───────────────────────────────────────────────────────
  FAILED_TO_PERFORM_MODERATION_ACTION: 'Failed to perform moderation action',
  FAILED_TO_SUBMIT_REPORT: 'Failed to submit report',
  FAILED_TO_FETCH_GAMES_UNDER_REVIEW: 'Failed to fetch games under review',

  // ── STREAMS & FEED ───────────────────────────────────────────────────
  TITLE_REQUIRED: 'Title is required',
  ACTIVE_STREAM_EXISTS: 'You already have an active stream',
  ACTIVE_BROADCAST_EXISTS:
    'You already have an active broadcast. Please close it first.',
  STREAM_ALREADY_RUNNING: 'Stream already running',
  STREAM_NOT_FOUND: 'Stream not found',
  STREAM_NOT_LIVE: 'Stream is not live yet',
  INVALID_STATUS: 'Invalid status',
  FAILED_TO_START_STREAM: 'Failed to start stream',
  FAILED_TO_CREATE_STREAM: 'Failed to create stream',
  FAILED_TO_UPDATE_STATUS: 'Failed to update status',
  FAILED_TO_UPDATE_STREAM: 'Failed to update stream',
  FAILED_TO_FETCH_FEED: 'Failed to fetch feed',
  MEDIA_SERVER_URL_NOT_CONFIGURED: 'Media server URL not configured',
  FAILED_TO_CREATE_STREAM_IN_DB: 'Failed to create stream in DB',

  // ── ROOMS ────────────────────────────────────────────────────────────
  ROOM_NOT_FOUND: 'Room not found',
  STREAM_ROOM_NOT_FOUND: 'Stream Room not found',
  ROOM_NOT_CREATED: 'Room not found. Call stream:create_room first.',
  ALREADY_CONNECTED: 'You are already connected to this room.',

  // ── TRANSPORT ────────────────────────────────────────────────────────
  TRANSPORT_NOT_FOUND: 'Transport not found',
  FAILED_TO_RESUME_CONSUMER: 'Failed to resume consumer',

  // ── CONSUMER ─────────────────────────────────────────────────────────
  CONSUMER_NOT_FOUND: 'Consumer not found',
  CANNOT_CONSUME: 'Cannot consume',

  // ── PRODUCER ─────────────────────────────────────────────────────────
  KIND_REQUIRED: 'kind is required',

  // ── GAMES ────────────────────────────────────────────────────────────
  GAME_NOT_FOUND: 'Game not found',
  GAME_CREATION_FAILED: 'Failed to create game',
  GAME_JOIN_FAILED: 'Failed to join the game',
  INVALID_GAME_STATUS: 'Invalid game status',
  HOST_ONLY_INVITE: 'Only the host can invite a moderator',
  INVITE_ONLY_IN_WAITING:
    'Moderators can only be invited when the game is in WAITING state',
  MODERATOR_NOT_FOUND: 'Moderator not found in the system',
  MODERATOR_ALREADY_IN_GAME: 'Moderator is already in this game',
  MODERATOR_OFFLINE: 'Moderator is currently offline',
  INVITATION_NOT_FOUND_OR_EXPIRED: 'Invitation not found or has expired',
  INVITATION_MISMATCH: 'This invitation is not for you',
  NO_WINNER_LINKED: 'No winner linked',
  ACTIVITY_NOT_FOUND: 'Activity not found',
  GAME_NOT_ACTIVE: 'Game is not active',
  GAME_ALREADY_FINISHED: 'Cannot change status of a finished game',
  CANNOT_JOIN_FINISHED_GAME: 'Cannot join a finished game',
  HOST_ONLY: 'Unauthorized: You are not the host of this game',
  MISSING_GAME_OR_USER_ID_FOR_PERMISSION_CHECK:
    'System Error: Missing gameId or userId for permission check',
  NO_ACTIVE_GAME_FOR_STREAM: 'No active game for this stream',
  SELF_MESSAGE_NOT_ALLOWED: 'You cannot send a message to yourself',

  QUESTION_NOT_FOUND: 'Question not found',
  QUESTION_ALREADY_RESOLVED: 'Question is already resolved',
  QUESTION_ALREADY_CLOSED: 'Question is already closed',
  QUESTION_TEXT_REQUIRED: 'Question text cannot be empty',
  QUESTION_OPTIONS_REQUIRED: 'At least 2 options required',
  MISSING_REQUIRED_QUESTION_FIELDS:
    'Missing required fields: gameId, questionText',
  MINIMUM_TWO_ANSWER_OPTIONS_REQUIRED: 'At least 2 answer options are required',
  OPTION_ID_REQUIRED: 'optionId is required (the correct answer)',
  FAILED_TO_HANDLE_QUESTION_PAUSE: 'Failed to handle question pause',
  ERROR_CREATING_QUESTION: 'Error creating the question',
  ERROR_RESOLVING_QUESTION: 'Error resolving the question',
  // why: Different endpoints: one fetches a single question, the other fetches all questions for a game.
  ERROR_FETCHING_QUESTION: 'Error fetching the question',
  ERROR_FETCHING_GAME_QUESTIONS: 'Error fetching the questions',
  NOT_AUTHORIZED_TO_RESOLVE_QUESTION:
    'You are not authorized to resolve this question',

  // ── CHAT ─────────────────────────────────────────────────────────────
  FAILED_TO_RETRIEVE_CHAT_HISTORY: 'Failed to retrieve chat history.',

  // ── NOTIFICATIONS ────────────────────────────────────────────────────
  FAILED_TO_FETCH_NOTIFICATIONS: 'Failed to fetch notifications',
  FAILED_TO_UPDATE_NOTIFICATION: 'Failed to update notification',

  // ── NOTIFICATION CONTENT ─────────────────────────────────────────────
  GAME_UNDER_REVIEW_TITLE: 'Your game is under review',
  GAME_UNDER_REVIEW_MESSAGE:
    'Your game has received multiple reports and is now under review by the HyPulse team.',

  // ── FINANCE ──────────────────────────────────────────────────────────
  MISSING_CARD_DETAILS: 'Missing required credit card details',
  FAILED_TO_SAVE_CARD: 'Failed to save credit card',
  AMOUNT_AND_TYPE_REQUIRED: 'Amount and type are required',
  FAILED_TO_CREATE_TRANSACTION: 'Failed to create transaction',
  INSUFFICIENT_COINS: 'Insufficient Coins',
  MISSING_REQUIRED_METADATA: 'Missing required metadata',
  INTERNAL_PROCESSING_ERROR: 'Internal processing error',
  VALID_COINS_AMOUNT_REQUIRED: 'Valid coins amount is required',
  BET_FAILED: 'Bet failed',

  // ── ANALYTICS ────────────────────────────────────────────────────────
  FAILED_TO_REPORT_ANALYTICS: 'Failed to report analytics',
};
