import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { UserPickerStep } from '../components/UserPickerStep';

// Single-select moderator picker; skippable (its pick never reaches the server).
export function InviteModeratorStep(props) {
  const { t } = useTranslation('host');

  return (
    <UserPickerStep
      {...props}
      mode="single"
      title={t('hostInvitation', 'Game Host Invitation')}
      placeholder={t('whoWillHost', 'Who will host your game?')}
      hint={t('moderatorOptional', 'Optional — you can skip this')}
    />
  );
}

InviteModeratorStep.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
  current: PropTypes.number.isRequired,
};
