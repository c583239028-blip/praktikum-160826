const HLS_SEGMENT_DURATION_SECONDS = 2;
const HLS_SOURCE_MANIFEST_FILENAME = 'source.m3u8';
const HLS_SEGMENT_FILENAME_PATTERN = 'segment_%09d.ts';
const HLS_FLAGS = 'append_list+independent_segments+temp_file';

// Single source of truth for the HLS output settings that matter for
// segment-retention/continuity behavior across a relaunch. Consumed by
// ffmpeg.service.js (which writes source.m3u8) and hls-playlist.service.js
// (which reads it), so the two can never drift out of sync — plus the
// integration tests that exercise the same values production uses.
export const HLS_OUTPUT_CONFIG = {
  segmentDurationSeconds: HLS_SEGMENT_DURATION_SECONDS,
  segmentFilenamePattern: HLS_SEGMENT_FILENAME_PATTERN,
  sourceManifestFilename: HLS_SOURCE_MANIFEST_FILENAME,
  hlsFlags: HLS_FLAGS,
};
