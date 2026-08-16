// packages/shared/src/constants/errors.js
import { MAX_ACTIVE_PLAYERS } from './roomLimits.js';

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
  NOT_AUTHORIZED_NO_TOKEN: 'Not authorized: No token provided',
  NOT_AUTHORIZED_USER_BANNED: 'Not authorized: User is banned',
  NOT_AUTHORIZED_INVALID_TOKEN: 'Not authorized: Invalid token',
  AUTHENTICATION_ERROR: 'Authentication error',
  SERVER_ERROR_REGISTRATION: 'Server error during registration',
  SERVER_ERROR_LOGIN: 'Server error during login',
  UNAUTHORIZED: 'Unauthorized',
  SENDER_ID_MISMATCH: 'Sender does not match authenticated user',

  // ── GENERAL VALIDATIONS ──────────────────────────────────────────────
  USER_ID_REQUIRED: 'User ID is required',
  USER_NOT_FOUND: 'User not found',
  MISSING_USER_IDS: 'Missing user IDs',
  MISSING_REQUIRED_FIELDS: 'Missing required fields',
  NOTIFICATION_NOT_FOUND: 'Notification not found',
  TARGET_USER_ID_REQUIRED: 'targetUserId is required',
  INVALID_DATA_FORMAT: 'Invalid data format',
  GENERIC_ERROR_PREFIX: 'Error: {message}',

  // ── MODERATION ───────────────────────────────────────────────────────
  FAILED_TO_PERFORM_MODERATION_ACTION: 'Failed to perform moderation action',
  FAILED_TO_SUBMIT_REPORT: 'Failed to submit report',
  FAILED_TO_FETCH_GAMES_UNDER_REVIEW: 'Failed to fetch games under review',
  FAILED_TO_ENFORCE_MEDIA_MODERATION: 'Failed to enforce media moderation',

  // ── STREAMS & FEED ───────────────────────────────────────────────────
  TITLE_REQUIRED: 'Title is required',
  ACTIVE_STREAM_EXISTS: 'You already have an active stream',
  ACTIVE_BROADCAST_EXISTS:
    'You already have an active broadcast. Please close it first.',
  STREAM_ALREADY_RUNNING: 'Stream already running',
  STREAM_NOT_FOUND: 'Stream not found',
  STREAM_NOT_LIVE: 'Stream is not live yet',
  INVALID_STATUS: 'Invalid status',
  FAILED_TO_CREATE_STREAM: 'Failed to create stream',
  FAILED_TO_UPDATE_STATUS: 'Failed to update status',
  FAILED_TO_UPDATE_STREAM: 'Failed to update stream',
  FAILED_TO_FETCH_FEED: 'Failed to fetch feed',
  MEDIA_SERVER_URL_NOT_CONFIGURED: 'Media server URL not configured',
  FAILED_TO_CREATE_STREAM_IN_DB: 'Failed to create stream in DB',
  INVALID_STREAM_ID: 'Invalid streamId format',

  // ── ROOMS ────────────────────────────────────────────────────────────
  ROOM_NOT_FOUND: 'Room not found',
  STREAM_ROOM_NOT_FOUND: 'Stream Room not found',
  ROOM_NOT_CREATED: 'Room not found. Call stream:create_room first.',
  ROOM_FULL: `Room is full — maximum ${MAX_ACTIVE_PLAYERS} active players reached`,
  ALREADY_CONNECTED: 'You are already connected to this room.',

  // ── TRANSPORT ────────────────────────────────────────────────────────
  TRANSPORT_NOT_FOUND: 'Transport not found',
  FAILED_TO_RESUME_CONSUMER: 'Failed to resume consumer',
  RTP_PORT_POOL_EXHAUSTED: 'No RTP ports available',

  // ── CONSUMER ─────────────────────────────────────────────────────────
  CONSUMER_NOT_FOUND: 'Consumer not found',
  CANNOT_CONSUME: 'Cannot consume',

  // ── PRODUCER ─────────────────────────────────────────────────────────
  KIND_REQUIRED: 'kind is required',
  RTP_PARAMETERS_REQUIRED: 'rtpParameters is required',
  PRODUCER_NOT_FOUND: 'Producer not found',
  NOT_PRODUCER_OWNER: 'Not the owner of this producer',
  MUTED_BY_MODERATOR:
    'You have been muted by a moderator and cannot unmute yourself',

  // ── GAMES ────────────────────────────────────────────────────────────
  GAME_NOT_FOUND: 'Game not found',
  FAILED_TO_CREATE_GAME: 'Failed to create game',
  FAILED_TO_JOIN_GAME: 'Failed to join the game',
  INVALID_GAME_STATUS: 'Invalid game status',
  INVALID_GAME_TYPE: 'Invalid or missing gameType',
  HOST_ONLY_CAN_INVITE_MODERATOR: 'Only the host can invite a moderator',
  CAN_ONLY_INVITE_MODERATOR_WHEN_WAITING:
    'Moderators can only be invited when the game is in WAITING state',
  MODERATOR_NOT_FOUND: 'Moderator not found in the system',
  MODERATOR_ALREADY_IN_GAME: 'Moderator is already in this game',
  MODERATOR_NOT_CONNECTED: 'Moderator is currently offline',
  INVITATION_NOT_FOUND_OR_EXPIRED: 'Invitation not found or has expired',
  INVITATION_NOT_FOR_YOU: 'This invitation is not for you',
  NO_WINNER_LINKED: 'No winner linked',
  ACTIVITY_NOT_FOUND: 'Activity not found',
  GAME_NOT_ACTIVE: 'Game is not active',
  GAME_ALREADY_FINISHED: 'Cannot change status of a finished game',
  CANNOT_JOIN_FINISHED_GAME: 'Cannot join a finished game',
  HOST_ONLY: 'Unauthorized: You are not the host of this game',
  INSUFFICIENT_VIEWERS_FOR_MODERATOR:
    'Not enough active viewers for moderator to join',
  ALREADY_CONNECTED_TO_ROOM: 'You are already connected to this room.',
  WELCOME_BACK_TO_GAME: 'Welcome back! You are connected to game {gameId}',
  SUCCESSFULLY_JOINED_GAME: 'Successfully joined game as {role}',
  BET_FAILED: 'Bet failed',
  INVALID_STATUS_ALLOWED_VALUES: 'Invalid status. Allowed values: {values}',
  MISSING_GAME_OR_USER_ID_FOR_PERMISSION_CHECK:
    'System Error: Missing gameId or userId for permission check',
  NO_ACTIVE_GAME_FOR_STREAM: 'No active game for this stream',
  SELF_MESSAGE_NOT_ALLOWED: 'You cannot send a message to yourself',

  QUESTION_NOT_FOUND: 'Question not found',
  QUESTION_ALREADY_RESOLVED: 'Question is already resolved',
  QUESTION_ALREADY_CLOSED: 'Question is already closed',
  NOT_GAME_PARTICIPANT: 'You are not a participant in this game',
  NOT_AUTHORIZED_TO_BET: 'Only viewers can place bets on questions',
  OPTION_DOES_NOT_BELONG_TO_QUESTION:
    'Selected option does not belong to this question',
  QUESTION_TEXT_REQUIRED: 'Question text cannot be empty',
  QUESTION_OPTIONS_REQUIRED: 'At least 2 options required',
  MISSING_REQUIRED_QUESTION_FIELDS:
    'Missing required fields: gameId, questionText',
  MINIMUM_TWO_ANSWER_OPTIONS_REQUIRED: 'At least 2 answer options are required',
  // Q1b — שאלת צופה ומעברי אישור
  QUESTION_NOT_PENDING_APPROVAL:
    'Question is not pending approval and cannot be approved or rejected',
  ERROR_SUBMITTING_VIEWER_QUESTION: 'Error submitting the viewer question',
  ERROR_APPROVING_QUESTION: 'Error approving the question',
  ERROR_REJECTING_QUESTION: 'Error rejecting the question',
  OPTION_ID_REQUIRED: 'optionId is required (the correct answer)',
  ERROR_CREATING_QUESTION: 'Error creating the question',
  ERROR_RESOLVING_QUESTION: 'Error resolving the question',
  // why: Different endpoints: one fetches a single question, the other fetches all questions for a game.
  ERROR_FETCHING_QUESTION: 'Error fetching the question',
  ERROR_FETCHING_GAME_QUESTIONS: 'Error fetching the questions',
  NOT_AUTHORIZED_TO_RESOLVE_QUESTION:
    'You are not authorized to resolve this question',
  ERROR_CREATING_GAME: 'Error creating the game',
  ERROR_UPDATING_STATUS: 'Error updating status',
  ERROR_JOINING_GAME: 'Error joining game',
  ERROR_LOADING_FEED: 'Error loading feed',
  GAME_NOT_FOUND_IN_HISTORY: 'Game not found in history',
  UNAUTHORIZED_VIEW_PARTICIPANTS: 'Unauthorized to view participants',
  INVALID_GAME_ID: 'Invalid game ID',
  ERROR_LOADING_PARTICIPANTS: 'Error loading participants',

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
  INVALID_GIFT_VALUE: 'Gift value must be a positive number',
  GIFT_EXCEEDS_MAX:
    'Gift value exceeds the maximum allowed amount of {max} coins',

  // ── ANALYTICS ────────────────────────────────────────────────────────
  FAILED_TO_REPORT_ANALYTICS: 'Failed to report analytics',
};
