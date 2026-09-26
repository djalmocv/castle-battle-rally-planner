import { useReducer, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import { GridSettings, RallyLead, Alliance } from '../types';

const LOCAL_STORAGE_LEADS_KEY = 'castle_battle_leads';
const LOCAL_STORAGE_SETTINGS_KEY = 'castle_battle_settings';
const LOCAL_STORAGE_ALLIANCES_KEY = 'castle_battle_alliances';

/** A single undoable snapshot of the planner: the roster, grid config, and alliance tags. */
export interface PlannerDocument {
  leads: RallyLead[];
  settings: GridSettings;
  alliances: Alliance[];
}

interface HistoryState {
  past: PlannerDocument[];
  present: PlannerDocument;
  future: PlannerDocument[];
}

/** Cap the history stack so long editing sessions don't grow memory unbounded. */
const MAX_HISTORY = 50;

type Action =
  | { type: 'INIT'; document: PlannerDocument }
  | { type: 'SET_LEADS'; updater: SetStateAction<RallyLead[]> }
  | { type: 'SET_SETTINGS'; updater: SetStateAction<GridSettings> }
  | { type: 'SET_ALLIANCES'; updater: SetStateAction<Alliance[]> }
  | { type: 'LOAD'; document: PlannerDocument }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function resolve<T>(value: SetStateAction<T>, current: T): T {
  return typeof value === 'function' ? (value as (prev: T) => T)(current) : value;
}

/** Push the current present onto the past stack and set a new present, clearing redo. */
function commit(state: HistoryState, present: PlannerDocument): HistoryState {
  return {
    past: [...state.past, state.present].slice(-MAX_HISTORY),
    present,
    future: [],
  };
}

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'INIT':
      return { past: [], present: action.document, future: [] };

    case 'SET_LEADS': {
      const leads = resolve(action.updater, state.present.leads);
      if (leads === state.present.leads) return state;
      return commit(state, { ...state.present, leads });
    }

    case 'SET_SETTINGS': {
      const settings = resolve(action.updater, state.present.settings);
      if (settings === state.present.settings) return state;
      return commit(state, { ...state.present, settings });
    }

    case 'SET_ALLIANCES': {
      const alliances = resolve(action.updater, state.present.alliances);
      if (alliances === state.present.alliances) return state;
      return commit(state, { ...state.present, alliances });
    }

    case 'LOAD':
      return commit(state, action.document);

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, MAX_HISTORY),
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        present: next,
        future: state.future.slice(1),
      };
    }

    default:
      return state;
  }
}

export interface PlannerState {
  leads: RallyLead[];
  settings: GridSettings;
  alliances: Alliance[];
  setLeads: Dispatch<SetStateAction<RallyLead[]>>;
  setSettings: Dispatch<SetStateAction<GridSettings>>;
  setAlliances: Dispatch<SetStateAction<Alliance[]>>;
  /** Replace the whole document (share link, preset, template) as one undoable step. */
  loadDocument: (document: PlannerDocument) => void;
  /** Seed the document without recording history (initial load). */
  initialize: (document: PlannerDocument) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Owns the planner's roster + grid settings with undo/redo history and
 * localStorage persistence. Roster and settings changes are recorded as
 * discrete, reversible steps; view-only state (zoom/pan) lives elsewhere.
 */
export function usePlannerState(initialSettings: GridSettings): PlannerState {
  const [state, dispatch] = useReducer(reducer, {
    past: [],
    present: { leads: [], settings: initialSettings, alliances: [] },
    future: [],
  });

  const { leads, settings, alliances } = state.present;

  // Persist roster (clearing storage when the roster is emptied).
  useEffect(() => {
    if (leads.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_LEADS_KEY, JSON.stringify(leads));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_LEADS_KEY);
    }
  }, [leads]);

  // Persist grid configuration.
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Persist alliance tags (clearing storage when the list is emptied).
  useEffect(() => {
    if (alliances.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_ALLIANCES_KEY, JSON.stringify(alliances));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ALLIANCES_KEY);
    }
  }, [alliances]);

  const setLeads = useCallback<Dispatch<SetStateAction<RallyLead[]>>>(
    (updater) => dispatch({ type: 'SET_LEADS', updater }),
    []
  );

  const setSettings = useCallback<Dispatch<SetStateAction<GridSettings>>>(
    (updater) => dispatch({ type: 'SET_SETTINGS', updater }),
    []
  );

  const setAlliances = useCallback<Dispatch<SetStateAction<Alliance[]>>>(
    (updater) => dispatch({ type: 'SET_ALLIANCES', updater }),
    []
  );

  const loadDocument = useCallback(
    (document: PlannerDocument) => dispatch({ type: 'LOAD', document }),
    []
  );

  const initialize = useCallback(
    (document: PlannerDocument) => dispatch({ type: 'INIT', document }),
    []
  );

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  return {
    leads,
    settings,
    alliances,
    setLeads,
    setSettings,
    setAlliances,
    loadDocument,
    initialize,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
