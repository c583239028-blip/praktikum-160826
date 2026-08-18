import React from 'react';
import PropTypes from 'prop-types';
import { InvitationDialog } from './InvitationDialog';
import { RejectedInvitation } from './RejectedInvitation';
import { EnteringScreen } from './EnteringScreen';

const JoinLifecycle = ({
  state,
  role,
  countdown,
  onAccept,
  onDecline,
  inviterName,
  inviterImageUri,
}) => {
  if (state === 'entering') {
    return <EnteringScreen />;
  }

  if (state === 'rejected') {
    return <RejectedInvitation role={role} onClose={onDecline} />;
  }

  if (state === 'dialog') {
    return (
      <InvitationDialog
        inviterName={inviterName}
        inviterImageUri={inviterImageUri}
        role={role}
        onAccept={onAccept}
        onReject={onDecline}
        initialCountdown={countdown ?? 60}
      />
    );
  }

  return null;
};

JoinLifecycle.propTypes = {
  state: PropTypes.oneOf(['entering', 'rejected', 'dialog']).isRequired,
  role: PropTypes.oneOf(['player', 'moderator']).isRequired,
  countdown: PropTypes.number,
  onAccept: PropTypes.func,
  onDecline: PropTypes.func,
  inviterName: PropTypes.string,
  inviterImageUri: PropTypes.string,
};

export default JoinLifecycle;
