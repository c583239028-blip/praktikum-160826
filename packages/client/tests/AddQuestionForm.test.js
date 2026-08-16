import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AddQuestionForm } from '../src/components/game/questionModerator/AddQuestionForm';
import { createQuestion } from '../src/services/questionsApi';
import { DEFAULT_TIME_LIMIT } from '../constants/timeLimits';

// Return the i18n key as-is so we can query by key (matches QuestionCard.test.js).
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

// The unit under test is the payload mapping (SCRUM-310), not the network —
// mock the API client so we can assert exactly what gets sent.
jest.mock('../src/services/questionsApi', () => ({
  createQuestion: jest.fn(),
}));

// SafeAreaView normally needs a provider; render its children directly in tests.
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
}));

const baseProps = {
  gameId: 'game-123',
  onClose: jest.fn(),
  onQuestionAdded: jest.fn(),
  onNavigateToDrafts: jest.fn(),
  onNavigateToViewerQuestions: jest.fn(),
};

// Fill a valid question: text + two non-empty options (canSubmit needs >= 2).
// Deliberately padded with spaces to prove the payload is trimmed.
function fillValidQuestion(utils) {
  fireEvent.changeText(
    utils.getByPlaceholderText('addQuestion.yourQuestion'),
    '  Best move?  '
  );
  const options = utils.getAllByPlaceholderText(
    'addQuestion.answerPlaceholder'
  );
  fireEvent.changeText(options[0], '  e4  ');
  fireEvent.changeText(options[1], '  d4  ');
}

describe('AddQuestionForm — real submit wiring (SCRUM-310)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createQuestion.mockResolvedValue({ id: 'q-1' });
  });

  it('renders without throwing (wiring intact after mock removal)', () => {
    expect(() => render(<AddQuestionForm {...baseProps} />)).not.toThrow();
  });

  it('publishes: responseTime maps to timeLimit, options are trimmed objects, no isDraft', async () => {
    const utils = render(<AddQuestionForm {...baseProps} />);
    fillValidQuestion(utils);

    fireEvent.press(utils.getByText('addQuestion.publish'));

    await waitFor(() => expect(createQuestion).toHaveBeenCalledTimes(1));
    expect(createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'game-123',
        questionText: 'Best move?',
        options: [{ text: 'e4' }, { text: 'd4' }],
        timeLimit: DEFAULT_TIME_LIMIT,
      })
    );
    // A published question must NOT be sent as a draft.
    expect(createQuestion.mock.calls[0][0]).not.toHaveProperty('isDraft');

    await waitFor(() => {
      expect(baseProps.onQuestionAdded).toHaveBeenCalledTimes(1);
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('saves a draft through the same endpoint with isDraft:true', async () => {
    const utils = render(<AddQuestionForm {...baseProps} />);
    fillValidQuestion(utils);

    fireEvent.press(utils.getByText('addQuestion.draftSaved'));

    await waitFor(() => expect(createQuestion).toHaveBeenCalledTimes(1));
    expect(createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'game-123',
        questionText: 'Best move?',
        options: [{ text: 'e4' }, { text: 'd4' }],
        timeLimit: DEFAULT_TIME_LIMIT,
        isDraft: true,
      })
    );
    // A saved draft confirms by navigating to the drafts list, and must not be
    // reported as a published question.
    await waitFor(() =>
      expect(baseProps.onNavigateToDrafts).toHaveBeenCalledTimes(1)
    );
    expect(baseProps.onQuestionAdded).not.toHaveBeenCalled();
  });

  it('does not call the API when the question is incomplete (< 2 options)', () => {
    const utils = render(<AddQuestionForm {...baseProps} />);
    fireEvent.changeText(
      utils.getByPlaceholderText('addQuestion.yourQuestion'),
      'Only a question, no options'
    );

    // Publish is disabled by canSubmit, so pressing it is a no-op.
    fireEvent.press(utils.getByText('addQuestion.publish'));

    expect(createQuestion).not.toHaveBeenCalled();
  });
});
