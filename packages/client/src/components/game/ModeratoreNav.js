import React from 'react';
import PropTypes from 'prop-types';
import { GameNav } from './GameNav';
import SettingsIcon from '../../../assets/icons/settings.svg';
import AddQuestionIcon from '../../../assets/icons/add-question.svg';
import WaitingIcon from '../../../assets/icons/waiting.svg';
import PersonQuestionIcon from '../../../assets/icons/person-question.svg';
export default function ModeratoreNav({
  onSettingsPress,
  onAddQuestionPress,
  onOpenQuestionsPress,
  onViewerQuestionsPress,
  openQuestionsCount,
}) {
  return (
    <GameNav
      icons={[
        {
          id: 'settings',
          icon: SettingsIcon,
          // TODO: מסך/קומפוננטת הגדרות עדיין לא נכתבה - כרגע רק log
          onPress: () => {
            console.log('settings pressed');
            onSettingsPress?.();
          },
        },    
        {
          id: 'WaitingIcon',
          icon: WaitingIcon,
          badgeCount: openQuestionsCount,
          onPress: onOpenQuestionsPress,
        },
        {
          id: 'AddQuestionIcon',
          icon: AddQuestionIcon,
          onPress: onAddQuestionPress,
        },
        {
          id: 'PersonQuestionIcon',
          icon: PersonQuestionIcon,
          onPress: onViewerQuestionsPress,
        },
      ]}
    />
  );
}

ModeratoreNav.propTypes = {
  onSettingsPress: PropTypes.func,
  onAddQuestionPress: PropTypes.func.isRequired,
  onOpenQuestionsPress: PropTypes.func.isRequired,
  onViewerQuestionsPress: PropTypes.func.isRequired,
  openQuestionsCount: PropTypes.number,
};

ModeratoreNav.defaultProps = {
  openQuestionsCount: 0,
};
