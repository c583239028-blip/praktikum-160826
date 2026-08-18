import { socketMiddleware } from '../src/store/middleware/socketMiddleware';
import * as socketService from '../src/services/socket.service';
import { addParticipant } from '../src/store/slices/participantsSlice';
import { SOCKET_EVENTS } from '@worldplay/shared';
jest.mock('../src/services/socket.service', () => ({
  getAppSocket: jest.fn(),
}));
describe('socketMiddleware - GAME.ROOM_UPDATE', () => {
  it('dispatches addParticipant when room_update fires', () => {
    let registeredHandler;
    const mockSocket = {
      off: jest.fn(),
      on: jest.fn((event, handler) => {
        if (event === SOCKET_EVENTS.GAME.ROOM_UPDATE)
          registeredHandler = handler;
      }),
    };

    jest.spyOn(socketService, 'getAppSocket').mockReturnValue(mockSocket);

    const store = { dispatch: jest.fn() };
    socketMiddleware()(store); // runs setupListener synchronously since socket exists

    // Simulate server emitting the event
    registeredHandler({
      type: 'join',
      userId: 'u1',
      username: 'Dana',
      role: 'PLAYER',
    });

    expect(store.dispatch).toHaveBeenCalledWith(
      addParticipant({ userId: 'u1', username: 'Dana', role: 'PLAYER' })
    );
  });

  it('does not dispatch when userId is missing', () => {
    let registeredHandler;
    const mockSocket = {
      off: jest.fn(),
      on: jest.fn((event, handler) => {
        if (event === SOCKET_EVENTS.GAME.ROOM_UPDATE)
          registeredHandler = handler;
      }),
    };
    jest.spyOn(socketService, 'getAppSocket').mockReturnValue(mockSocket);

    const store = { dispatch: jest.fn() };
    socketMiddleware()(store);

    registeredHandler({ type: 'join', username: 'Dana' }); // no userId

    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
