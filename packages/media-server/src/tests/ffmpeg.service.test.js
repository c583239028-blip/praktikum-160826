import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: mocks.spawn,
}));

vi.mock('fs', () => ({
  default: {
    writeFileSync: mocks.writeFileSync,
  },
}));

import { FFmpegService } from '../services/ffmpeg.service.js';

const createFakeFFmpegProcess = () => ({
  kill: vi.fn(),
  on: vi.fn(),
});

const createInput = ({ kind, role, port }) => ({
  participantId: `${role.toLowerCase()}-user`,
  kind,
  role,
  port,
});

const startFFmpeg = (activeInputs) => {
  const service = new FFmpegService({
    streamId: 'stream-grid-test',
    streamPath: '/tmp/streams/stream-grid-test',
  });

  service.start(activeInputs);

  return mocks.spawn.mock.calls[0][1];
};

describe('FFmpegService — video grid', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.spawn.mockReturnValue(createFakeFFmpegProcess());
  });

  it('keeps host-only video mapped directly without filter_complex', () => {
    const args = startFFmpeg([
      createInput({
        kind: 'video',
        role: 'HOST',
        port: 11000,
      }),
    ]);

    expect(args).not.toContain('-filter_complex');

    const mapIndex = args.indexOf('-map');

    expect(args[mapIndex + 1]).toBe('0:v:0');
  });

  it('creates a two-tile xstack grid for host and player', () => {
    const args = startFFmpeg([
      createInput({
        kind: 'video',
        role: 'HOST',
        port: 11000,
      }),
      createInput({
        kind: 'video',
        role: 'PLAYER',
        port: 11001,
      }),
    ]);

    const filterIndex = args.indexOf('-filter_complex');
    const filter = args[filterIndex + 1];

    expect(filter).toContain('[0:v:0]scale=640:360');
    expect(filter).toContain('[0:v:1]scale=640:360');
    expect(filter).toContain('xstack=inputs=2:layout=0_0|640_0');

    const mapIndex = args.indexOf('-map');

    expect(args[mapIndex + 1]).toBe('[videoOut]');
  });

  it('excludes moderator video from the main grid', () => {
    const args = startFFmpeg([
      createInput({
        kind: 'video',
        role: 'HOST',
        port: 11000,
      }),
      createInput({
        kind: 'video',
        role: 'MODERATOR',
        port: 11001,
      }),
      createInput({
        kind: 'video',
        role: 'PLAYER',
        port: 11002,
      }),
    ]);

    const filterIndex = args.indexOf('-filter_complex');
    const filter = args[filterIndex + 1];

    expect(filter).toContain('[0:v:0]scale=640:360');
    expect(filter).toContain('[0:v:2]scale=640:360');
    expect(filter).not.toContain('[0:v:1]scale=640:360');
    expect(filter).toContain('xstack=inputs=2');
  });

  it('adds moderator video as an overlay above the main grid', () => {
    const args = startFFmpeg([
      createInput({
        kind: 'video',
        role: 'HOST',
        port: 11000,
      }),
      createInput({
        kind: 'video',
        role: 'MODERATOR',
        port: 11001,
      }),
      createInput({
        kind: 'video',
        role: 'PLAYER',
        port: 11002,
      }),
    ]);

    const filterIndex = args.indexOf('-filter_complex');
    const filter = args[filterIndex + 1];

    expect(filter).toContain('[0:v:0]scale=640:360');
    expect(filter).toContain('[0:v:2]scale=640:360');
    expect(filter).toContain('xstack=inputs=2');

    expect(filter).toContain('[0:v:1]scale=320:180');
    expect(filter).toContain('[videoOut]');
    expect(filter).toContain('overlay=');

    const mapIndex = args.indexOf('-map');

    expect(args[mapIndex + 1]).toBe('[compositeVideo]');
  });

  it('creates a four-tile grid for host and three players', () => {
    const args = startFFmpeg([
      createInput({
        kind: 'video',
        role: 'HOST',
        port: 11000,
      }),
      createInput({
        kind: 'video',
        role: 'PLAYER',
        port: 11001,
      }),
      createInput({
        kind: 'video',
        role: 'PLAYER',
        port: 11002,
      }),
      createInput({
        kind: 'video',
        role: 'PLAYER',
        port: 11003,
      }),
    ]);

    const filterIndex = args.indexOf('-filter_complex');
    const filter = args[filterIndex + 1];

    expect(filter).toContain('xstack=inputs=4');
    expect(filter).toContain('layout=0_0|640_0|0_360|640_360');
  });

  it('overlays moderator on host-only video without creating xstack', () => {
    const args = startFFmpeg([
      createInput({
        kind: 'video',
        role: 'HOST',
        port: 11000,
      }),
      createInput({
        kind: 'video',
        role: 'MODERATOR',
        port: 11001,
      }),
    ]);

    const filterIndex = args.indexOf('-filter_complex');
    const filter = args[filterIndex + 1];

    expect(filter).not.toContain('xstack=');
    expect(filter).toContain('[0:v:1]scale=320:180');
    expect(filter).toContain('overlay=');

    const mapIndex = args.indexOf('-map');

    expect(args[mapIndex + 1]).toBe('[compositeVideo]');
  });
  it('keeps the complete source HLS history without deleting segments', () => {
    const args = startFFmpeg([
      createInput({
        kind: 'video',
        role: 'HOST',
        port: 11000,
      }),
    ]);

    const listSizeIndex = args.indexOf('-hls_list_size');
    const flagsIndex = args.indexOf('-hls_flags');
    const segmentFilenameIndex = args.indexOf('-hls_segment_filename');
    const streamPath = '/tmp/streams/stream-grid-test';

    expect(args[listSizeIndex + 1]).toBe('0');

    expect(args[flagsIndex + 1]).toContain('append_list');
    expect(args[flagsIndex + 1]).toContain('independent_segments');
    expect(args[flagsIndex + 1]).toContain('temp_file');
    expect(args[flagsIndex + 1]).not.toContain('delete_segments');

    expect(args[segmentFilenameIndex + 1]).toBe(
      path.join(streamPath, 'segment_%09d.ts')
    );

    expect(args.at(-1)).toBe(path.join(streamPath, 'source.m3u8'));
  });
});
