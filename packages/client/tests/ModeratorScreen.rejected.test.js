import React from 'react';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import ModeratorScreen from '../src/screens/ModeratorScreen';

jest.mock('../src/services/socket.service', () => ({
  getAppSocket: () => null,
}));

jest.mock('../src/components/game/JoinLifecycle/InvitationDialog', () => ({
  InvitationDialog: (props) => {
    global.__capturedInvitationDialogProps = props;
    return null;
  },
}));

jest.mock('../src/components/game/JoinLifecycle/RejectedInvitation', () => ({
  RejectedInvitation: (props) => {
    global.__capturedRejectedInvitationProps = props;
    return null;
  },
}));

describe('ModeratorScreen — rejected invitation onClose wiring', () => {
  beforeEach(() => {
    global.__capturedInvitationDialogProps = undefined;
    global.__capturedRejectedInvitationProps = undefined;
  });

  it('passes the screen-level onClose to RejectedInvitation (not undefined)', () => {
    const onCloseMock = jest.fn();

    render(<ModeratorScreen onClose={onCloseMock} />);

    fireEvent.press(screen.getByText('DEV: הדמה הזמנה'));

    act(() => {
      global.__capturedInvitationDialogProps.onReject();
    });

    const rejectedProps = global.__capturedRejectedInvitationProps;
    expect(rejectedProps).toBeDefined();
    expect(rejectedProps.onClose).toBe(onCloseMock);
    expect(typeof rejectedProps.onClose).toBe('function');

    act(() => {
      rejectedProps.onClose();
    });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('does not trigger a setState-during-render warning', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const onCloseMock = jest.fn();

    render(<ModeratorScreen onClose={onCloseMock} />);
    fireEvent.press(screen.getByText('DEV: הדמה הזמנה'));

    act(() => {
      global.__capturedInvitationDialogProps.onReject();
    });

    const hadRenderWarning = consoleErrorSpy.mock.calls.some((call) =>
      String(call[0]).includes('Cannot update a component')
    );
    expect(hadRenderWarning).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});
