import React from 'react';
import { TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import { Colors, BorderRadius } from '../../../../constants/design';
// TODO: לוודא שם/נתיב אייקוני מיקרופון (לפי הדפוס של power.svg שכבר קיים בפרויקט)
import MicOffIcon from '../../../../assets/icons/unspeaker.svg';
import MicIcon from '../../../../assets/icons/speaker1.svg';

// import Speack1Icon from '../../../../assets/icons/speaker1.svg';

// TODO: אין ב-design.js טוקן מידה (size) ל-40 - יש רק Spacing למרווחים/ריפוד.
// לכרגע השארתי מספר קשיח לגודל העיגול עצמו (זה לא "רווח" בין אלמנטים, זה width/height
// של הקומפוננטה) - לאשר מול Sara אם צריך טוקן ייעודי לגדלי אייקונים.
const ICON_WRAPPER_SIZE = 40;

export function SpeakerIconWrapper({ isMuted, onPress }) {
  const Icon = isMuted ? MicOffIcon : MicIcon;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: ICON_WRAPPER_SIZE,
        height: ICON_WRAPPER_SIZE,
        borderRadius: BorderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isMuted ? Colors.error.main : null,
      }}
    >
      <Icon
        width={20}
        height={20}
        color={isMuted ? Colors.surface.white : Colors.surface.dark}
      />
    </TouchableOpacity>
  );
}

SpeakerIconWrapper.propTypes = {
  isMuted: PropTypes.bool.isRequired,
  onPress: PropTypes.func.isRequired,
};
