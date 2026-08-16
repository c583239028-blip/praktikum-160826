// packages/shared/src/constants/gameRules.js

export const MIN_VIEWERS_FOR_MODERATOR = 50;

export const MIN_WAGER = 10;

export const INSUFFICIENT_VIEWERS_CODE = 'INSUFFICIENT_VIEWERS';

export const MODERATOR_RESPONSE_STATUS = {
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
};

export const MODERATOR_RESPONSE_REASON = {
  TIMEOUT: 'timeout',
  MODERATOR_TIMEOUT: 'moderator_timeout',
  REJECTED_BY_MODERATOR: 'rejected_by_moderator',
};

export const ROOM_UPDATE_TYPE = {
  USER_JOINED: 'USER_JOINED',
  MODERATOR_ACCEPTED: 'MODERATOR_ACCEPTED',
};

export const JOIN_ELIGIBILITY_STATUS = {
  ALREADY_JOINED: 'ALREADY_JOINED',
  ELIGIBLE: 'ELIGIBLE',
};
