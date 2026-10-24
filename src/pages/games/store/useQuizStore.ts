import { create } from 'zustand'
import type {
  AnswerCountPayload,
  FinishedPayload,
  LobbyPlayer,
  PlayerScore,
  QuestionPayload,
  RevealPayload,
  RoomState,
  RoomStatus,
} from '../api/quizApi'

/**
 * One store for the whole game, shared by host and player screens.
 * Screens render from `status`; nothing guesses the phase from timers.
 */
interface QuizState {
  userId: string | null
  code: string | null
  roomId: string | null
  quizTitle: string
  status: RoomStatus | null
  isHost: boolean
  total: number
  question: QuestionPayload | null
  reveal: RevealPayload | null
  scores: PlayerScore[]
  lobby: LobbyPlayer[]
  answered: number
  myChoice: number | null
  me: RoomState['me']
  /** ms to add to Date.now() to get server time */
  clockOffset: number
  connected: boolean
  error: string | null

  setUserId: (userId: string) => void
  hydrate: (state: RoomState, clockOffset: number) => void
  onQuestion: (q: QuestionPayload) => void
  onAnswerCount: (c: AnswerCountPayload) => void
  onReveal: (r: RevealPayload) => void
  onFinished: (f: FinishedPayload) => void
  setLobby: (players: LobbyPlayer[]) => void
  setMyChoice: (choice: number | null) => void
  setConnected: (connected: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const initial = {
  userId: null,
  code: null,
  roomId: null,
  quizTitle: '',
  status: null,
  isHost: false,
  total: 0,
  question: null,
  reveal: null,
  scores: [],
  lobby: [],
  answered: 0,
  myChoice: null,
  me: null,
  clockOffset: 0,
  connected: true, // false only after a drop, so the first load shows no "Reconnecting"
  error: null,
}

export const useQuizStore = create<QuizState>((set) => ({
  ...initial,

  setUserId: (userId) => set({ userId }),

  hydrate: (s, clockOffset) =>
    set({
      code: s.code,
      roomId: s.room_id,
      quizTitle: s.quiz_title,
      status: s.status,
      isHost: s.is_host,
      total: s.total,
      question: s.question ?? null,
      reveal: s.reveal ?? null,
      scores: s.scores,
      answered: s.answered ?? 0,
      myChoice: s.my_choice ?? null,
      me: s.me,
      clockOffset,
      error: null,
    }),

  onQuestion: (q) =>
    set((state) => ({
      status: 'question',
      question: q,
      reveal: null,
      answered: 0,
      myChoice: null,
      total: q.total || state.total,
    })),

  onAnswerCount: (c) =>
    set((state) => (state.question?.question_id === c.question_id ? { answered: c.answered } : {})),

  onReveal: (r) =>
    set((state) => {
      const mine = r.scores.find((p) => p.user_id === state.userId)
      return {
        status: 'reveal',
        reveal: r,
        scores: r.scores,
        me: mine && state.me ? { ...state.me, score: mine.score, streak: mine.streak } : state.me,
      }
    }),

  onFinished: (f) => set({ status: 'finished', scores: f.scores, question: null }),

  setLobby: (lobby) => set({ lobby }),
  setMyChoice: (myChoice) => set({ myChoice }),
  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error }),
  // keep userId: the anonymous session outlives a room
  reset: () => set((state) => ({ ...initial, userId: state.userId })),
}))
