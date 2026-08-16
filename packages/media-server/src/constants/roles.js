// The moderator is never a main-grid video tile — ffmpeg.service.js excludes
// them when building the xstack grid, and stream.service.js must exclude them
// the same way when deciding whether there's any video worth launching
// FFmpeg for. Shared here so the two checks can't drift apart.
export const MODERATOR_ROLE = 'MODERATOR';
