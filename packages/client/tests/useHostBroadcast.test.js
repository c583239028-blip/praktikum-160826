import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useHostBroadcast } from '../src/hooks/useHostBroadcast';
import gameStreamReducer from '../src/store/slices/gameStreamSlice';
import { MediasoupManager } from '../src/services/MediasoupManager';
import {
  emitPromise,
  emitMediaPromise,
  getMediaSocket,
} from '../src/services/socket.service';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('../src/services/MediasoupManager', () => ({
  MediasoupManager: {
    getLocalStream: jest.fn(),
    initDevice: jest.fn(),
    createTransport: jest.fn(),
  },
}));

jest.mock('../src/services/socket.service', () => ({
  getAppSocket: jest.fn(),
  getMediaSocket: jest.fn(),
  emitPromise: jest.fn(),
  emitMediaPromise: jest.fn(),
}));

jest.mock('@worldplay/shared', () => ({
  SOCKET_EVENTS: {
    STREAM: {
      CREATE_ROOM: 'stream:create_room',
      PRODUCER_PAUSE: 'stream:producer_pause',
      ENDED: 'stream:ended',
      VIEWER_COUNT: 'stream:viewer_count',
    },
    GAME: {
      STATUS_UPDATE: 'game:status_update',
    },
  },
}));

function makeFakeStream() {
  const track = { stop: jest.fn(), enabled: true };
  return {
    getVideoTracks: () => [track],
    getAudioTracks: () => [track],
    getTracks: () => [track, track],
  };
}

function makeStore(status) {
  return configureStore({
    reducer: { gameStream: gameStreamReducer },
    preloadedState: {
      gameStream: {
        gameId: 'game-123',
        streamId: 'stream-456',
        gameType: null,
        role: 'HOST',
        status,
        viewMode: 'WebRTC',
        hlsUrl: null,
        isPaused: false,
        isFrozen: false,
        activeProducers: [],
      },
    },
  });
}

function wrapperFor(store) {
  return function Wrapper({ children }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useHostBroadcast - startBroadcast resume vs fresh go-live', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MediasoupManager.getLocalStream.mockResolvedValue(makeFakeStream());
    MediasoupManager.initDevice.mockResolvedValue();
    MediasoupManager.createTransport.mockResolvedValue({
      produce: jest.fn().mockResolvedValue({ id: 'producer-1' }),
    });
    emitMediaPromise.mockImplementation((event) => {
      if (event === 'stream:create_room') {
        return Promise.resolve({ rtpCapabilities: {} });
      }
      return Promise.resolve();
    });
    emitPromise.mockResolvedValue({});
  });

  it('sends GAME.STATUS_UPDATE(ACTIVE) on a fresh go-live (status WAITING)', async () => {
    const store = makeStore('WAITING');
    const { result } = renderHook(() => useHostBroadcast(), {
      wrapper: wrapperFor(store),
    });

    await act(async () => {
      await result.current.startBroadcast();
    });

    expect(emitPromise).toHaveBeenCalledWith('game:status_update', {
      gameId: 'game-123',
      status: 'ACTIVE',
    });
    expect(result.current.isLive).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it('does not resend GAME.STATUS_UPDATE when resuming an already-ACTIVE game', async () => {
    const store = makeStore('ACTIVE');
    const { result } = renderHook(() => useHostBroadcast(), {
      wrapper: wrapperFor(store),
    });

    await act(async () => {
      await result.current.startBroadcast();
    });

    expect(emitPromise).not.toHaveBeenCalled();
    expect(result.current.isLive).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it('still surfaces an error (not a silent hang) if resume media setup fails', async () => {
    const store = makeStore('ACTIVE');
    MediasoupManager.getLocalStream.mockRejectedValue(new Error('camera busy'));
    const { result } = renderHook(() => useHostBroadcast(), {
      wrapper: wrapperFor(store),
    });

    await act(async () => {
      await result.current.startBroadcast();
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.isLive).toBe(false);
  });
});

describe('useHostBroadcast - live viewer count (SCRUM-275)', () => {
  let mediaHandlers;
  let fakeMediaSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    MediasoupManager.getLocalStream.mockResolvedValue(makeFakeStream());
    MediasoupManager.initDevice.mockResolvedValue();
    MediasoupManager.createTransport.mockResolvedValue({
      produce: jest.fn().mockResolvedValue({ id: 'producer-1' }),
    });
    emitMediaPromise.mockImplementation((event) => {
      if (event === 'stream:create_room') {
        return Promise.resolve({ rtpCapabilities: {} });
      }
      return Promise.resolve();
    });
    emitPromise.mockResolvedValue({});

    // Capture the handler the hook registers so the test can emit events to it.
    mediaHandlers = {};
    fakeMediaSocket = {
      on: jest.fn((event, handler) => {
        mediaHandlers[event] = handler;
      }),
      off: jest.fn(),
    };
    getMediaSocket.mockReturnValue(fakeMediaSocket);
  });

  // Go live so isLive flips true and the viewer-count listener attaches.
  async function goLive() {
    const store = makeStore('WAITING');
    const view = renderHook(() => useHostBroadcast(), {
      wrapper: wrapperFor(store),
    });
    await act(async () => {
      await view.result.current.startBroadcast();
    });
    return view;
  }

  it('updates viewerCount from a stream:viewer_count event for this stream', async () => {
    const { result } = await goLive();

    expect(fakeMediaSocket.on).toHaveBeenCalledWith(
      'stream:viewer_count',
      expect.any(Function)
    );

    act(() => {
      mediaHandlers['stream:viewer_count']({
        streamId: 'stream-456',
        viewerCount: 42,
      });
    });

    expect(result.current.viewerCount).toBe(42);
  });

  it('ignores a viewer_count event for a different stream (no overwrite)', async () => {
    const { result } = await goLive();

    act(() => {
      mediaHandlers['stream:viewer_count']({
        streamId: 'stream-456',
        viewerCount: 10,
      });
    });
    expect(result.current.viewerCount).toBe(10);

    act(() => {
      mediaHandlers['stream:viewer_count']({
        streamId: 'other-stream',
        viewerCount: 999,
      });
    });
    // The stray room's count must not clobber ours.
    expect(result.current.viewerCount).toBe(10);
  });

  it('detaches the listener on unmount', async () => {
    const { unmount } = await goLive();

    unmount();

    expect(fakeMediaSocket.off).toHaveBeenCalledWith(
      'stream:viewer_count',
      expect.any(Function)
    );
  });
});
