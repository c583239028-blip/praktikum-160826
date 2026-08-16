// mock-allowed: SCRUM-316 — placeholder until the real user-search API lands.
// The picker shows a "Demo" banner in the UI (see UserPickerStep) and the
// selection is never sent to the server, so this is an intentional D-04 escape hatch.
//
// Placeholder ids until the real users API lands — NOT real backend users, so a
// selection is never sent to the server (it would fail the FK check).
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
