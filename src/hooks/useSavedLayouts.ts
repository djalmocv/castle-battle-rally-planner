import { useCallback, useEffect, useState } from 'react';
import { SavedLayout } from '../types';

const LOCAL_STORAGE_LAYOUTS_KEY = 'castle_battle_layouts';

function loadInitial(): SavedLayout[] {
  const stored = localStorage.getItem(LOCAL_STORAGE_LAYOUTS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as SavedLayout[];
  } catch (e) {
    console.error('Failed to parse saved layouts from storage', e);
    return [];
  }
}

export interface SavedLayoutsState {
  savedLayouts: SavedLayout[];
  addLayout: (layout: SavedLayout) => void;
  importLayouts: (layouts: SavedLayout[]) => void;
  removeLayout: (id: string) => void;
}

/**
 * Manages the persisted list of saved layout templates. Loading a template
 * back into the active planner is handled by the caller, since that mutates
 * the undoable planner document.
 */
export function useSavedLayouts(): SavedLayoutsState {
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>(loadInitial);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_LAYOUTS_KEY, JSON.stringify(savedLayouts));
  }, [savedLayouts]);

  const addLayout = useCallback((layout: SavedLayout) => {
    setSavedLayouts((prev) => [...prev, layout]);
  }, []);

  const importLayouts = useCallback((layouts: SavedLayout[]) => {
    setSavedLayouts((prev) => [...prev, ...layouts]);
  }, []);

  const removeLayout = useCallback((id: string) => {
    setSavedLayouts((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return { savedLayouts, addLayout, importLayouts, removeLayout };
}
