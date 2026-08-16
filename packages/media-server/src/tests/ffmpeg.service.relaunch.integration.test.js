import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HLS_OUTPUT_CONFIG } from '../services/ffmpeg.service.js';

/**
 * Integration test — NO mocks. Spawns real ffmpeg processes.
 *
 * Purpose: lock in FFmpeg's real `append_list` behavior across a roster-change
 * relaunch (same streamPath, same source.m3u8, ffmpeg process killed and
 * respawned) — the exact sequence `restartFFmpeg`/`launchFFmpeg` perform in
 * stream.service.js.
 *
 * This does NOT go through FFmpegService/buildFFmpegArgs directly, because
 * exercising the real grid/SDP/RTP path would require a live RTP source.
 * Instead it uses the actual HLS_OUTPUT_CONFIG constants that production
 * uses, with a synthetic `lavfi` input — isolating exactly the muxer
 * behavior this test cares about (segment numbering + manifest
 * continuity), decoupled from video composition.
 *
 * Requires the `ffmpeg` binary on PATH. Skipped automatically if absent.
 */

// spawnSync reports a missing binary via `error` instead of emitting an
// async 'error' event, so this stays synchronous (required by describe.skipIf)
// and cannot leak an unhandled exception when ffmpeg is absent.
const hasFfmpeg = () => !spawnSync('ffmpeg', ['-version']).error;

const runFfmpegPass = ({ streamPath, timeoutMs }) =>
  new Promise((resolve, reject) => {
    const sourceManifestPath = path.join(
      streamPath,
      HLS_OUTPUT_CONFIG.sourceManifestFilename
    );
    const segmentFilename = path.join(
      streamPath,
      HLS_OUTPUT_CONFIG.segmentFilenamePattern
    );

    const args = [
      '-loglevel',
      'warning',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=320x240:rate=15',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-g',
      '15',
      '-sc_threshold',
      '0',
      '-f',
      'hls',
      '-hls_time',
      String(HLS_OUTPUT_CONFIG.segmentDurationSeconds),
      '-hls_list_size',
      '0',
      '-hls_flags',
      HLS_OUTPUT_CONFIG.hlsFlags,
      '-hls_segment_filename',
      segmentFilename,
      sourceManifestPath,
    ];

    const proc = spawn('ffmpeg', args);
    const timer = setTimeout(() => proc.kill('SIGTERM'), timeoutMs);

    proc.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
    proc.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

const listSegments = (streamPath) =>
  fs
    .readdirSync(streamPath)
    .filter((name) => name.endsWith('.ts'))
    .sort();

const readManifest = (streamPath) =>
  fs.readFileSync(
    path.join(streamPath, HLS_OUTPUT_CONFIG.sourceManifestFilename),
    'utf8'
  );

describe.skipIf(!hasFfmpeg())(
  'FFmpeg HLS relaunch — real process integration',
  () => {
    let streamPath;

    beforeEach(() => {
      streamPath = fs.mkdtempSync(
        path.join(os.tmpdir(), 'ffmpeg-relaunch-test-')
      );
    });

    afterEach(() => {
      fs.rmSync(streamPath, { recursive: true, force: true });
    });

    it('continues segment numbering and preserves prior segments across a relaunch', async () => {
      await runFfmpegPass({ streamPath, timeoutMs: 1500 });

      const segmentsAfterFirstRun = listSegments(streamPath);
      expect(segmentsAfterFirstRun.length).toBeGreaterThan(0);

      const firstSegmentStatBefore = fs.statSync(
        path.join(streamPath, segmentsAfterFirstRun[0])
      );

      await runFfmpegPass({ streamPath, timeoutMs: 1500 });

      const segmentsAfterSecondRun = listSegments(streamPath);
      const firstSegmentStatAfter = fs.statSync(
        path.join(streamPath, segmentsAfterFirstRun[0])
      );

      // More segments exist — the second run appended rather than
      // starting a fresh manifest.
      expect(segmentsAfterSecondRun.length).toBeGreaterThan(
        segmentsAfterFirstRun.length
      );

      // The earliest segment from the first run was not overwritten
      // (same size/mtime) — this is the segment a frozen viewer may
      // still be pointing at.
      expect(firstSegmentStatAfter.size).toBe(firstSegmentStatBefore.size);
      expect(firstSegmentStatAfter.mtimeMs).toBe(
        firstSegmentStatBefore.mtimeMs
      );

      // No numbering reset: every filename from run 1 still appears,
      // and the highest-numbered file from run 2 is beyond run 1's range.
      for (const segment of segmentsAfterFirstRun) {
        expect(segmentsAfterSecondRun).toContain(segment);
      }
      expect(segmentsAfterSecondRun.at(-1)).not.toBe(
        segmentsAfterFirstRun.at(-1)
      );
    }, 15000);

    it('marks the relaunch boundary with #EXT-X-DISCONTINUITY', async () => {
      await runFfmpegPass({ streamPath, timeoutMs: 1500 });
      await runFfmpegPass({ streamPath, timeoutMs: 1500 });

      const manifest = readManifest(streamPath);
      const discontinuityCount = (manifest.match(/#EXT-X-DISCONTINUITY/g) ?? [])
        .length;

      // One from the (expected) initial marker, one injected by ffmpeg
      // at the relaunch boundary.
      expect(discontinuityCount).toBeGreaterThanOrEqual(2);
    }, 15000);
  }
);
