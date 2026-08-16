// Mock friends for the DEMO invitation screens (moderator + players). These
// are placeholders until the real users API lands — their ids are NOT real
// backend users, so a selection is never sent to the server (it would fail the
// FK check). Shared by InviteModeratorStep and PlayerInvitationStep.
export const MOCK_USERS = [
  { id: '1', name: 'Jackson Reed', color: '#F29A5C' },
  { id: '2', name: 'Sophia Turner', color: '#B300FF' },
  { id: '3', name: 'Liam Brooks', color: '#3B91AB' },
  { id: '4', name: 'Mia Carter', color: '#E2282B' },
  { id: '5', name: 'Noah Smith', color: '#33A815' },
];

export const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const filterUsers = (q) =>
  MOCK_USERS.filter((u) =>
    u.name.toLowerCase().includes(q.trim().toLowerCase())
  );
