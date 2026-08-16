// packages/client/src/hooks/useWinLossPlayer.js
import { useState, useEffect } from 'react';
import { useVideoPlayer } from 'expo-video';
import { logger } from '@worldplay/shared';
import { getAnimationUri } from '../services/animationAssets.service';

/**
 * מנהל את מחזור החיים של נגן הוידאו עבור WinLossAnimation:
 * בניית ה-player, מעקב אחרי סטטוס טעינה/ניגון, וקריאה ל-onFinish
 * הן בסיום נורמלי (playToEnd) והן בכשל טעינה.
 */
export function useWinLossPlayer(type, onFinish) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const uri = getAnimationUri(type);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    const statusSub = player.addListener(
      'statusChange',
      ({ status: newStatus, error }) => {
        if (newStatus === 'readyToPlay') {
          setStatus('ready');
          player.play();
        } else if (newStatus === 'error') {
          logger.error('useWinLossPlayer: failed to load video', error);
          setStatus('error');
          onFinish?.();
        }
      }
    );

    const endSub = player.addListener('playToEnd', () => {
      onFinish?.();
    });

    return () => {
      statusSub.remove();
      endSub.remove();
    };
  }, [player, onFinish]);

  return { player, status };
}
