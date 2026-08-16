import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { createAndStartGame } from '../store/actions/gameActions';

// Wraps the create-game call. Extracted from HostScreen's handleCreateGame so
// HostFlow can drive "go live" from it. Holds its own creating/error state and
// returns a boolean so the caller can gate the transition to LIVE (advance only
// when the game was actually created). Per the brief: NO `description`.
export function useCreateGame() {
  const dispatch = useDispatch();
  const { t } = useTranslation('host');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Returns true on success, false on failure.
  const createGame = async ({ title, gameType, moderatorId } = {}) => {
    setCreateError(null);
    setCreating(true);
    try {
      await dispatch(
        createAndStartGame({
          title,
          gameType,
          moderatorId: moderatorId?.trim() || undefined,
        })
      );
      return true;
    } catch (err) {
      setCreateError(err.message || t('createGameFailed', 'יצירת המשחק נכשלה'));
      return false;
    } finally {
      setCreating(false);
    }
  };

  return { createGame, creating, createError };
}
