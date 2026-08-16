import { updateBalances } from '../slices/walletSlice';
import { setActiveQuestion, markResolved } from '../slices/questionsSlice';
import { addParticipant } from '../slices/participantsSlice';
import * as socketService from '../../services/socket.service';
import { SOCKET_EVENTS } from '@worldplay/shared';

export const socketMiddleware = () => (store) => {
  const setupListener = () => {
    const currentSocket = socketService.getAppSocket();

    if (currentSocket) {
      // Remove previous listeners to avoid duplicates on reconnect
      currentSocket.off(SOCKET_EVENTS.WALLET.BALANCE_UPDATE);
      currentSocket.off(SOCKET_EVENTS.GAME.NEW_QUESTION);
      currentSocket.off(SOCKET_EVENTS.GAME.QUESTION_RESOLVED);
      currentSocket.off(SOCKET_EVENTS.GAME.ROOM_UPDATE);

      currentSocket.on(SOCKET_EVENTS.WALLET.BALANCE_UPDATE, (data) => {
        store.dispatch(updateBalances(data));
      });

      currentSocket.on(SOCKET_EVENTS.GAME.NEW_QUESTION, (data) => {
        store.dispatch(setActiveQuestion(data));
      });

      currentSocket.on(SOCKET_EVENTS.GAME.QUESTION_RESOLVED, () => {
        store.dispatch(markResolved());
      });

      currentSocket.on(SOCKET_EVENTS.GAME.ROOM_UPDATE, (data) => {
        if (!data) return;

        const { userId, username, role, avatarUrl } = data;
        if (!userId) return;

        store.dispatch(addParticipant({ userId, username, role, avatarUrl }));
      });
    } else {
      setTimeout(setupListener, 1000);
    }
  };

  setupListener();

  return (next) => (action) => next(action);
};
