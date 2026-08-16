import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import LiveScreen, { getJoinableGameId } from '../src/app/(tabs)/live';
import { feedApi } from '../src/services/feedApi';
import { joinGame } from '../src/store/actions/gameActions';
import { renderWithProviders } from './__helpers__/renderWithProviders';

const mockPush = jest.fn();

jest.setTimeout(15000);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../src/services/feedApi', () => ({
  feedApi: {
    getPublicFeed: jest.fn(),
  },
}));

jest.mock('../src/store/actions/gameActions', () => ({
  joinGame: jest.fn(),
}));

jest.mock('../src/hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({
    guardedAction: (action) => action(),
    isModalVisible: false,
    closeAuthModal: jest.fn(),
  }),
}));

jest.mock('../src/components/StreamCard', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');

  return function MockStreamCard({ stream, onPress, disabled }) {
    return (
      <TouchableOpacity
        testID={`stream-${stream.id}`}
        onPress={onPress}
        disabled={disabled}
      >
        <Text>{stream.title}</Text>
      </TouchableOpacity>
    );
  };
});

jest.mock('../src/components/StreamCardSkeleton', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockSkeleton() {
    return <Text>feed-loading</Text>;
  };
});

jest.mock('../src/components/EmptyFeed', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockEmptyFeed() {
    return <Text>feed-empty</Text>;
  };
});

jest.mock('../src/components/ErrorState', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');

  return function MockErrorState({ onRetry }) {
    return (
      <TouchableOpacity testID="retry-feed" onPress={onRetry}>
        <Text>feed-error</Text>
      </TouchableOpacity>
    );
  };
});

jest.mock('../src/components/LazyAuthModal', () => () => null);

jest.mock('../src/components/Screen', () => {
  const React = require('react');
  const { View } = require('react-native');

  return function MockScreen({ children }) {
    return <View>{children}</View>;
  };
});

const liveStream = {
  id: 'stream-123',
  title: 'Live trivia',
  status: 'LIVE',
  hostId: 'host-123',
  host: { id: 'host-123', username: 'host' },
  games: [{ id: 'game-456', status: 'ACTIVE' }],
};

describe('getJoinableGameId', () => {
  it('prefers the active game when a stream has multiple games', () => {
    expect(
      getJoinableGameId({
        games: [
          { id: 'finished-game', status: 'FINISHED' },
          { id: 'active-game', status: 'ACTIVE' },
        ],
      })
    ).toBe('active-game');
  });

  it('rejects waiting, ambiguous, and missing games', () => {
    expect(
      getJoinableGameId({
        games: [{ id: 'only-game', status: 'WAITING' }],
      })
    ).toBeNull();
    expect(
      getJoinableGameId({
        games: [{ id: 'one' }, { id: 'two' }],
      })
    ).toBeNull();
    expect(getJoinableGameId({ games: [] })).toBeNull();
  });

  it('never exposes a finished game even when it is the only related game', () => {
    expect(
      getJoinableGameId({
        games: [{ id: 'finished-game', status: 'FINISHED' }],
      })
    ).toBeNull();
  });
});

describe('LiveScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    joinGame.mockImplementation((gameId, requestedRole) => async () => ({
      gameId,
      streamId: 'stream-123',
      role: requestedRole ?? 'PLAYER',
    }));
  });

  it('loads real streams and joins with game.id rather than stream.id', async () => {
    feedApi.getPublicFeed.mockResolvedValue({ streams: [liveStream] });
    const screen = renderWithProviders(<LiveScreen />);

    expect(screen.getByText('feed-loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Live trivia')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByTestId('stream-stream-123'));
    });

    expect(joinGame).toHaveBeenCalledWith('game-456');
    expect(joinGame).not.toHaveBeenCalledWith('stream-123');
    expect(mockPush).toHaveBeenCalledWith('/game_screen');
  });

  it('joins another host stream with the default PLAYER request', async () => {
    feedApi.getPublicFeed.mockResolvedValue({ streams: [liveStream] });
    const screen = renderWithProviders(<LiveScreen />, {
      authValue: {
        user: { id: 'player-123', username: 'player' },
        isGuest: false,
      },
    });

    await waitFor(() => expect(screen.getByText('Live trivia')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('stream-stream-123'));
    });

    expect(joinGame).toHaveBeenCalledWith('game-456');
    expect(joinGame).not.toHaveBeenCalledWith('game-456', 'HOST');
  });

  it('resumes the host session with HOST role instead of joining as PLAYER', async () => {
    feedApi.getPublicFeed.mockResolvedValue({ streams: [liveStream] });
    const screen = renderWithProviders(<LiveScreen />, {
      authValue: {
        user: { id: 'host-123', username: 'host' },
        isGuest: false,
      },
    });

    await waitFor(() => expect(screen.getByText('Live trivia')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('stream-stream-123'));
    });

    expect(joinGame).toHaveBeenCalledWith('game-456', 'HOST');
    expect(mockPush).toHaveBeenCalledWith('/game_screen');
  });

  it('detects the host from stream.host.id when hostId is absent', async () => {
    feedApi.getPublicFeed.mockResolvedValue({
      streams: [{ ...liveStream, hostId: undefined }],
    });
    const screen = renderWithProviders(<LiveScreen />, {
      authValue: {
        user: { id: 'host-123', username: 'host' },
        isGuest: false,
      },
    });

    await waitFor(() => expect(screen.getByText('Live trivia')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('stream-stream-123'));
    });

    expect(joinGame).toHaveBeenCalledWith('game-456', 'HOST');
  });

  it('does not render a stream that has no unambiguous joinable game', async () => {
    feedApi.getPublicFeed.mockResolvedValue({
      streams: [{ ...liveStream, games: [] }],
    });
    const screen = renderWithProviders(<LiveScreen />);

    await waitFor(() => expect(screen.getByText('feed-empty')).toBeTruthy());
    expect(screen.queryByTestId('stream-stream-123')).toBeNull();
    expect(joinGame).not.toHaveBeenCalled();
  });

  it('does not render a stream whose own status is not LIVE', async () => {
    feedApi.getPublicFeed.mockResolvedValue({
      streams: [{ ...liveStream, status: 'FINISHED' }],
    });
    const screen = renderWithProviders(<LiveScreen />);

    await waitFor(() => expect(screen.getByText('feed-empty')).toBeTruthy());
    expect(screen.queryByTestId('stream-stream-123')).toBeNull();
  });

  it('waits for joinGame to finish before navigating', async () => {
    let resolveJoin;
    const pendingJoin = new Promise((resolve) => {
      resolveJoin = resolve;
    });
    joinGame.mockImplementation(() => async () => pendingJoin);
    feedApi.getPublicFeed.mockResolvedValue({ streams: [liveStream] });
    const screen = renderWithProviders(<LiveScreen />);

    await waitFor(() => expect(screen.getByText('Live trivia')).toBeTruthy());
    fireEvent.press(screen.getByTestId('stream-stream-123'));

    expect(mockPush).not.toHaveBeenCalled();

    await act(async () => {
      resolveJoin({ gameId: 'game-456', streamId: 'stream-123' });
      await pendingJoin;
    });

    expect(mockPush).toHaveBeenCalledWith('/game_screen');
  });

  it('ignores repeated presses while a join is in progress', async () => {
    let resolveJoin;
    const pendingJoin = new Promise((resolve) => {
      resolveJoin = resolve;
    });
    joinGame.mockImplementation(() => async () => pendingJoin);
    feedApi.getPublicFeed.mockResolvedValue({ streams: [liveStream] });
    const screen = renderWithProviders(<LiveScreen />);

    await waitFor(() => expect(screen.getByText('Live trivia')).toBeTruthy());
    fireEvent.press(screen.getByTestId('stream-stream-123'));
    fireEvent.press(screen.getByTestId('stream-stream-123'));

    expect(joinGame).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveJoin({ gameId: 'game-456', streamId: 'stream-123' });
      await pendingJoin;
    });
  });

  it('shows the feed error state and retries loading', async () => {
    feedApi.getPublicFeed
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ streams: [liveStream] });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const screen = renderWithProviders(<LiveScreen />);

    await waitFor(() => expect(screen.getByText('feed-error')).toBeTruthy());
    fireEvent.press(screen.getByTestId('retry-feed'));
    await waitFor(() => expect(screen.getByText('Live trivia')).toBeTruthy());

    expect(feedApi.getPublicFeed).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  it('shows a join error and stays on LIVE when joining fails', async () => {
    feedApi.getPublicFeed
      .mockResolvedValueOnce({ streams: [liveStream] })
      .mockResolvedValueOnce({ streams: [] });
    joinGame.mockImplementation(() => async () => {
      throw new Error('join failed');
    });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const screen = renderWithProviders(<LiveScreen />);

    await waitFor(() => expect(screen.getByText('Live trivia')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('stream-stream-123'));
    });

    expect(screen.getByText('error_join_failed')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(feedApi.getPublicFeed).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});
