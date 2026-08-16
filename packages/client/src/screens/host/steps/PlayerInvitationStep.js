import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { UserPickerStep } from '../components/UserPickerStep';

// Multi-select player picker; skippable (its picks never reach the server).
export function PlayerInvitationStep(props) {
  const { t } = useTranslation('host');

  return (
    <UserPickerStep
      {...props}
      mode="multi"
      title={t('playerInvitation', 'Player invitation for the game')}
      placeholder={t('whoWillPlay', 'Who will be your players?')}
    />
  );
}

PlayerInvitationStep.propTypes = {
  value: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
};
