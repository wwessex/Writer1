import { useCallback, useReducer } from 'react';

/**
 * All modals/panels managed by AppContent.
 * Adding a new modal only requires adding its key here.
 */
export type ModalKey =
  | 'export'
  | 'snapshot'
  | 'analysis'
  | 'wordCount'
  | 'settings'
  | 'about'
  | 'dashboard'
  | 'onboarding'
  | 'characterBible'
  | 'aiWriting'
  | 'comments'
  | 'advancedAnalytics'
  | 'integrations'
  | 'projects'
  | 'sceneTemplates'
  | 'exportHistory'
  | 'aiPanel';

type ModalState = Record<ModalKey, boolean>;

type ModalAction =
  | { type: 'OPEN'; key: ModalKey }
  | { type: 'CLOSE'; key: ModalKey }
  | { type: 'TOGGLE'; key: ModalKey };

const initialState: ModalState = {
  export: false,
  snapshot: false,
  analysis: false,
  wordCount: false,
  settings: false,
  about: false,
  dashboard: false,
  onboarding: false,
  characterBible: false,
  aiWriting: false,
  comments: false,
  advancedAnalytics: false,
  integrations: false,
  projects: false,
  sceneTemplates: false,
  exportHistory: false,
  aiPanel: false,
};

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN':
      return state[action.key] ? state : { ...state, [action.key]: true };
    case 'CLOSE':
      return state[action.key] ? { ...state, [action.key]: false } : state;
    case 'TOGGLE':
      return { ...state, [action.key]: !state[action.key] };
    default:
      return state;
  }
}

export function useModalState() {
  const [modals, dispatch] = useReducer(modalReducer, initialState);

  const openModal = useCallback((key: ModalKey) => {
    dispatch({ type: 'OPEN', key });
  }, []);

  const closeModal = useCallback((key: ModalKey) => {
    dispatch({ type: 'CLOSE', key });
  }, []);

  const toggleModal = useCallback((key: ModalKey) => {
    dispatch({ type: 'TOGGLE', key });
  }, []);

  return { modals, openModal, closeModal, toggleModal } as const;
}
