import participantsReducer, {
  addParticipant,
  updateParticipant,
  removeParticipant,
  resetParticipants,
} from '../src/store/slices/participantsSlice';

describe('participantsSlice', () => {
  const initialState = { list: [] };

  it('adds a new participant', () => {
    const state = participantsReducer(
      initialState,
      addParticipant({ userId: 'u1', username: 'Dana', role: 'PLAYER' })
    );
    expect(state.list).toEqual([
      { userId: 'u1', username: 'Dana', role: 'PLAYER' },
    ]);
  });

  it('upserts existing participant instead of duplicating', () => {
    let state = participantsReducer(
      initialState,
      addParticipant({ userId: 'u1', username: 'Dana', role: 'PLAYER' })
    );
    state = participantsReducer(
      state,
      addParticipant({ userId: 'u1', username: 'Dana', role: 'MODERATOR' })
    );
    expect(state.list).toHaveLength(1);
    expect(state.list[0].role).toBe('MODERATOR');
  });

  it('ignores payload without userId', () => {
    const state = participantsReducer(
      initialState,
      addParticipant({ username: 'X' })
    );
    expect(state.list).toEqual([]);
  });

  it('removes a participant by userId', () => {
    let state = { list: [{ userId: 'u1', username: 'Dana', role: 'PLAYER' }] };
    state = participantsReducer(state, removeParticipant('u1'));
    expect(state.list).toEqual([]);
  });
});
