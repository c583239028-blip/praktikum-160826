import questionsReducer, {
  setActiveQuestion,
  markResolved,
  setQuestionsList,
  selectDraftQuestions,
  selectOpenQuestions,
  selectResolvedQuestions,
  fetchGameQuestions,
} from '../src/store/slices/questionsSlice';
import * as questionsApi from '../src/services/questionsApi';

jest.mock('../src/services/questionsApi');

describe('questionsSlice', () => {
  const initialState = {
    activeQuestion: null,
    isResolved: false,
    loading: false,
    error: null,
    questions: [],
  };

  it('updates activeQuestion and adds to questions on socket payload (questionId)', () => {
    const state = questionsReducer(
      initialState,
      setActiveQuestion({
        questionId: 'q1',
        questionText: 'What is 2+2?',
        rewardType: 'POT',
        options: [{ id: 'o1', text: '4' }],
        timeLimit: 30,
      })
    );

    expect(state.activeQuestion).toEqual({
      id: 'q1',
      questionText: 'What is 2+2?',
      rewardType: 'POT',
      options: [{ id: 'o1', text: '4' }],
      timeLimit: 30,
    });

    expect(state.questions).toEqual([
      {
        id: 'q1',
        questionText: 'What is 2+2?',
        rewardType: 'POT',
        options: [{ id: 'o1', text: '4' }],
        timeLimit: 30,
        isDraft: false,
        isResolved: false,
      },
    ]);
  });

  it('updates activeQuestion and adds to questions on REST-shaped payload (id)', () => {
    const state = questionsReducer(
      initialState,
      setActiveQuestion({
        id: 'q2',
        questionText: 'Capital of France?',
        rewardType: 'FIXED',
        options: [{ id: 'o1', text: 'Paris' }],
        timeLimit: null,
      })
    );

    expect(state.activeQuestion.id).toBe('q2');
    expect(state.questions).toHaveLength(1);
    expect(state.questions[0]).toMatchObject({
      id: 'q2',
      isDraft: false,
      isResolved: false,
    });
  });

  it('does not add a duplicate to questions if the id already exists', () => {
    let state = questionsReducer(
      initialState,
      setActiveQuestion({ questionId: 'q1', questionText: 'Q1' })
    );
    state = questionsReducer(
      state,
      setActiveQuestion({ questionId: 'q1', questionText: 'Q1 again' })
    );

    expect(state.questions).toHaveLength(1);
  });

  it('ignores payload without questionId or id', () => {
    const state = questionsReducer(
      initialState,
      setActiveQuestion({ questionText: 'No id here' })
    );

    expect(state).toEqual(initialState);
  });

  it('setQuestionsList replaces the full questions array', () => {
    const existing = {
      ...initialState,
      questions: [
        { id: 'old', questionText: 'Old', isDraft: false, isResolved: false },
      ],
    };

    const incoming = [
      { id: 'q1', questionText: 'Q1', isDraft: true, isResolved: false },
      { id: 'q2', questionText: 'Q2', isDraft: false, isResolved: true },
    ];

    const state = questionsReducer(existing, setQuestionsList(incoming));

    expect(state.questions).toEqual(incoming);
  });

  it('markResolved marks the matching question as resolved without removing it', () => {
    const stateWithActive = {
      ...initialState,
      activeQuestion: { id: 'q1', questionText: 'Q1' },
      questions: [
        { id: 'q1', questionText: 'Q1', isDraft: false, isResolved: false },
        { id: 'q2', questionText: 'Q2', isDraft: false, isResolved: false },
      ],
    };

    const state = questionsReducer(stateWithActive, markResolved());

    expect(state.activeQuestion).toBeNull();
    expect(state.isResolved).toBe(true);
    expect(state.questions).toHaveLength(2);
    expect(state.questions.find((q) => q.id === 'q1').isResolved).toBe(true);
    expect(state.questions.find((q) => q.id === 'q2').isResolved).toBe(false);
  });

  describe('fetchGameQuestions thunk', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('dispatches setQuestionsList with the questions returned by the API', async () => {
      const fetchedQuestions = [
        { id: 'q1', questionText: 'Q1', isDraft: false, isResolved: false },
        { id: 'q2', questionText: 'Q2', isDraft: true, isResolved: false },
      ];
      questionsApi.getGameQuestions.mockResolvedValue(fetchedQuestions);
      const dispatch = jest.fn();

      await fetchGameQuestions('game-1')(dispatch);

      expect(questionsApi.getGameQuestions).toHaveBeenCalledWith('game-1');
      expect(dispatch).toHaveBeenCalledWith(setQuestionsList(fetchedQuestions));
    });

    it('does not dispatch when the API call fails', async () => {
      questionsApi.getGameQuestions.mockRejectedValue(
        new Error('network error')
      );
      const dispatch = jest.fn();
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await fetchGameQuestions('game-1')(dispatch);

      expect(dispatch).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('selectors', () => {
    const rootState = {
      questions: {
        ...initialState,
        questions: [
          { id: 'd1', isDraft: true, isResolved: false },
          { id: 'o1', isDraft: false, isResolved: false },
          { id: 'o2', isDraft: false, isResolved: false },
          { id: 'r1', isDraft: false, isResolved: true },
          { id: 'r2', isDraft: true, isResolved: true },
        ],
      },
    };

    it('selectDraftQuestions returns only isDraft:true, isResolved:false', () => {
      expect(selectDraftQuestions(rootState)).toEqual([
        { id: 'd1', isDraft: true, isResolved: false },
      ]);
    });

    it('selectOpenQuestions returns only isDraft:false, isResolved:false', () => {
      expect(selectOpenQuestions(rootState)).toEqual([
        { id: 'o1', isDraft: false, isResolved: false },
        { id: 'o2', isDraft: false, isResolved: false },
      ]);
    });

    it('selectResolvedQuestions returns only isResolved:true', () => {
      expect(selectResolvedQuestions(rootState)).toEqual([
        { id: 'r1', isDraft: false, isResolved: true },
        { id: 'r2', isDraft: true, isResolved: true },
      ]);
    });
  });
});
