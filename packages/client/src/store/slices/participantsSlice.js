import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: [], // [{ userId, username, role, avatarUrl }]
};

const participantsSlice = createSlice({
  name: 'participants',
  initialState,
  reducers: {
    // Upsert: if userId already exists in the list, update its fields.
    // Otherwise, push a new participant entry.
    addParticipant: (state, action) => {
      const { userId, username, role, avatarUrl } = action.payload || {};
      if (!userId) return;

      const existing = state.list.find((p) => p.userId === userId);

      if (existing) {
        if (username !== undefined) existing.username = username;
        if (role !== undefined) existing.role = role;
        if (avatarUrl !== undefined) existing.avatarUrl = avatarUrl;
      } else {
        state.list.push({ userId, username, role, avatarUrl });
      }
    },

    updateParticipant: (state, action) => {
      const { userId, ...changes } = action.payload || {};
      if (!userId) return;

      const existing = state.list.find((p) => p.userId === userId);
      if (existing) {
        Object.assign(existing, changes);
      }
    },

    removeParticipant: (state, action) => {
      const userId = action.payload;
      state.list = state.list.filter((p) => p.userId !== userId);
    },

    resetParticipants: () => initialState,
  },
});

export const {
  addParticipant,
  updateParticipant,
  removeParticipant,
  resetParticipants,
} = participantsSlice.actions;
export default participantsSlice.reducer;
