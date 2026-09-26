import { useCallback, useEffect, useState } from 'react';
import { RallySyncGroup } from '../types';

const LOCAL_STORAGE_RALLY_GROUPS_KEY = 'castle_battle_rally_groups';

function loadInitial(): RallySyncGroup[] {
  const stored = localStorage.getItem(LOCAL_STORAGE_RALLY_GROUPS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as RallySyncGroup[];
  } catch (e) {
    console.error('Failed to parse rally groups from storage', e);
    return [];
  }
}

function makeId(): string {
  return `wave-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface RallyGroupsState {
  groups: RallySyncGroup[];
  addGroup: (name: string) => void;
  renameGroup: (id: string, name: string) => void;
  removeGroup: (id: string) => void;
  toggleMember: (id: string, leadId: string) => void;
  toggleMemberPet: (id: string, leadId: string) => void;
  setAllPets: (id: string, active: boolean) => void;
  startSequence: (id: string) => void;
  stopSequence: (id: string) => void;
}

/**
 * Manages the persisted list of synchronized rally waves. Kept separate from
 * the undoable planner document so editing waves mid-battle never interferes
 * with roster undo/redo, while still surviving reloads via localStorage.
 */
export function useRallyGroups(): RallyGroupsState {
  const [groups, setGroups] = useState<RallySyncGroup[]>(loadInitial);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_RALLY_GROUPS_KEY, JSON.stringify(groups));
  }, [groups]);

  const addGroup = useCallback((name: string) => {
    setGroups((prev) => [
      ...prev,
      { id: makeId(), name: name.trim() || `Wave ${prev.length + 1}`, leadIds: [], startEpochMs: null },
    ]);
  }, []);

  const renameGroup = useCallback((id: string, name: string) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));
  }, []);

  const removeGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const toggleMember = useCallback((id: string, leadId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const has = g.leadIds.includes(leadId);
        return {
          ...g,
          leadIds: has ? g.leadIds.filter((l) => l !== leadId) : [...g.leadIds, leadId],
          // Removing a member also drops any pet-active flag for them.
          petLeadIds: has ? (g.petLeadIds ?? []).filter((l) => l !== leadId) : g.petLeadIds,
        };
      })
    );
  }, []);

  const toggleMemberPet = useCallback((id: string, leadId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const current = g.petLeadIds ?? [];
        const has = current.includes(leadId);
        return {
          ...g,
          petLeadIds: has ? current.filter((l) => l !== leadId) : [...current, leadId],
        };
      })
    );
  }, []);

  const setAllPets = useCallback((id: string, active: boolean) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, petLeadIds: active ? [...g.leadIds] : [] } : g))
    );
  }, []);

  const startSequence = useCallback((id: string) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, startEpochMs: Date.now() } : g)));
  }, []);

  const stopSequence = useCallback((id: string) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, startEpochMs: null } : g)));
  }, []);

  return { groups, addGroup, renameGroup, removeGroup, toggleMember, toggleMemberPet, setAllPets, startSequence, stopSequence };
}
