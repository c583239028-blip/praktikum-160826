// packages/client/tests/WinLossAnimation.test.js
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { useVideoPlayer } from 'expo-video';
import { WinLossAnimation } from '../src/components/game/WinLossAnimation';

const mockPlayer = {
  loop: false,
  play: jest.fn(),
  addListener: jest.fn(),
};

jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: jest.fn((uri, configureFn) => {
    configureFn(mockPlayer);
    return mockPlayer;
  }),
}));

jest.mock('../constants/design', () => ({
  Colors: {
    primary: { default: '#00E5FF' },
    neutral: { 900: '#1F293B' },
  },
}));

describe('WinLossAnimation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer.addListener.mockImplementation(() => ({ remove: jest.fn() }));
  });

  it('builds the correct video URI for type="win"', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://test-server:8080';
    render(<WinLossAnimation type="win" onFinish={jest.fn()} />);

    expect(useVideoPlayer).toHaveBeenCalledWith(
      'http://test-server:8080/assets/animations/win_question_large.mp4',
      expect.any(Function)
    );
  });

  it('calls onFinish when playToEnd fires', () => {
    const onFinish = jest.fn();
    let playToEndHandler;
    mockPlayer.addListener.mockImplementation((event, handler) => {
      if (event === 'playToEnd') playToEndHandler = handler;
      return { remove: jest.fn() };
    });

    render(<WinLossAnimation type="lose" onFinish={onFinish} />);

    act(() => {
      playToEndHandler();
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('calls onFinish on load error instead of hanging forever', () => {
    const onFinish = jest.fn();
    let statusChangeHandler;
    mockPlayer.addListener.mockImplementation((event, handler) => {
      if (event === 'statusChange') statusChangeHandler = handler;
      return { remove: jest.fn() };
    });

    render(<WinLossAnimation type="win" onFinish={onFinish} />);

    act(() => {
      statusChangeHandler({ status: 'error', error: new Error('network') });
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
