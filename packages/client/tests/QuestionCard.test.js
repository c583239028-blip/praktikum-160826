import React from 'react';
import { render } from '@testing-library/react-native';
import QuestionCard from '../src/components/game/QuestionCard';

// QuestionCard calls useTranslation('question') and t('questionCard.placeBetPlaceholder').
// Mocked minimally so the test doesn't need real i18n resource files loaded —
// this does NOT mock ./ui/Card or ./ui/Btn, since the whole point of this
// test is to catch a broken import path to those files.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe('QuestionCard', () => {
  // Shape taken directly from QuestionCard.propTypes:
  // question.questionText (string, required), question.options[].{id, text} (required)
  const minimalQuestion = {
    id: 'q-1',
    questionText: 'What is the capital of France?',
    options: [{ id: 'opt-1', text: 'Paris' }],
  };

  it('imports and renders without throwing (regression: ./Card, ./Btn -> ./ui/Card, ./ui/Btn)', () => {
    // Before the fix, importing this module at all throws:
    //   Cannot find module './Card' from 'src/components/game/QuestionCard.js'
    // Not mocking ./ui/Card or ./ui/Btn on purpose — that's the exact
    // resolution path the fix touches.
    expect(() =>
      render(<QuestionCard question={minimalQuestion} />)
    ).not.toThrow();
  });

  it('renders the question text and its option', () => {
    const { getByText } = render(<QuestionCard question={minimalQuestion} />);
    expect(getByText(minimalQuestion.questionText)).toBeTruthy();
    expect(getByText('Paris')).toBeTruthy();
  });

  it('returns null and does not crash when question is not yet available', () => {
    // Covers the explicit guard in QuestionCard: "מניעת קריסה אם הנתונים
    // טרם הגיעו בזמן ה-Hydration של הסוקט". propTypes marks `question` as
    // required, so this intentionally passes undefined to exercise the
    // runtime guard rather than the type contract.
    expect(() => render(<QuestionCard question={undefined} />)).not.toThrow();
  });
});
