import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LeadPanel from './components/LeadPanel';
import CastleMap from './components/CastleMap';
import RallySyncPanel from './components/RallySyncPanel';
import { RallyLead, GridSettings, SavedLayout, PriorityLevel, Location2D } from './types';
import { assignPositions } from './utils/assignment';
import { exportToCSV, exportToPNG, getSVGImageBytes } from './utils/export';
import { serializeLayout, deserializeLayout } from './utils/serialization';
import { usePlannerState } from './hooks/usePlannerState';
import { useSavedLayouts } from './hooks/useSavedLayouts';
import { useRallyGroups } from './hooks/useRallyGroups';
import { CheckSquare, Info, Map as MapIcon, Zap } from 'lucide-react';

const DEFAULT_SETTINGS: GridSettings = {
  width: 32,
  height: 32,
  castleSize: 12,
  castleX: 10,
  castleY: 10,
  snapMode: '2x2',
  autoSide: 'both',
};

// Demo Preset definitions for quick start
const DEMO_PRESET_DEFAULT: Omit<RallyLead, 'id'>[] = [
  { name: 'John', priority: PriorityLevel.Highest, notes: 'Main Infantry Rally', position: null, locked: false },
  { name: 'Sarah', priority: PriorityLevel.High, notes: 'Cavalry Support', position: null, locked: false },
  { name: 'Mike', priority: PriorityLevel.Highest, notes: 'Archers Core', position: null, locked: false },
  { name: 'Emma', priority: PriorityLevel.Normal, notes: 'West Flank Defenses', position: null, locked: false },
  { name: 'Alex', priority: PriorityLevel.Low, notes: 'Reserve Support', position: null, locked: false },
];

const DEMO_PRESET_OMEGA: Omit<RallyLead, 'id'>[] = [
  { name: 'Ragnar', priority: PriorityLevel.Highest, notes: 'L1 Rally Lead - Inf', position: null, locked: false },
  { name: 'Athena', priority: PriorityLevel.Highest, notes: 'L1 Rally Lead - Cav', position: null, locked: false },
  { name: 'Leonidas', priority: PriorityLevel.Highest, notes: 'L1 Rally Lead - Arch', position: null, locked: false },
  { name: 'Empress', priority: PriorityLevel.High, notes: 'L2 Cavalry Main', position: null, locked: false },
  { name: 'Shadow', priority: PriorityLevel.High, notes: 'L2 Infantry Main', position: null, locked: false },
  { name: 'Kaiser', priority: PriorityLevel.High, notes: 'L2 Gate Garrison', position: null, locked: false },
  { name: 'Blizzard', priority: PriorityLevel.Normal, notes: 'Alliance Garrison', position: null, locked: false },
  { name: 'Viper', priority: PriorityLevel.Normal, notes: 'Cavalry Sweeper', position: null, locked: false },
  { name: 'Phoenix', priority: PriorityLevel.Normal, notes: 'T5 Archer Core', position: null, locked: false },
  { name: 'Ironclad', priority: PriorityLevel.Normal, notes: 'Defense Backup', position: null, locked: false },
  { name: 'Warden', priority: PriorityLevel.Normal, notes: 'East Gate Watch', position: null, locked: false },
  { name: 'Nomad', priority: PriorityLevel.Normal, notes: 'Siege Flanker', position: null, locked: false },
  { name: 'Goliath', priority: PriorityLevel.Low, notes: 'Infantry Garrison', position: null, locked: false },
  { name: 'Tempest', priority: PriorityLevel.Low, notes: 'Reinforcement Lead', position: null, locked: false },
  { name: 'Maverick', priority: PriorityLevel.Low, notes: 'Cavalry Reinforcements', position: null, locked: false },
  { name: 'Ghost', priority: PriorityLevel.Lowest, notes: 'Backup Garrison', position: null, locked: false },
  { name: 'Cyclone', priority: PriorityLevel.Lowest, notes: 'Auxiliary Guard', position: null, locked: false },
  { name: 'Whisper', priority: PriorityLevel.Lowest, notes: 'Fill Specialist', position: null, locked: false },
];

export default function App() {
  // --- Core States (roster + grid config with undo/redo history) ---
  const {
    leads,
    settings,
    setLeads,
    setSettings,
    loadDocument,
    initialize,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePlannerState(DEFAULT_SETTINGS);

  // Saved layout templates (persisted separately, not part of undo history)
  const { savedLayouts, addLayout, importLayouts, removeLayout } = useSavedLayouts();

  // Synchronized rally waves (persisted separately from undo history)
  const {
    groups: rallyGroups,
    addGroup: addRallyGroup,
    renameGroup: renameRallyGroup,
    removeGroup: removeRallyGroup,
    toggleMember: toggleRallyMember,
    toggleMemberPet: toggleRallyMemberPet,
    setAllPets: setRallyAllPets,
    startSequence: startRallySequence,
    stopSequence: stopRallySequence,
  } = useRallyGroups();

  // Which workspace view is active on the right side of the layout.
  const [activeView, setActiveView] = useState<'map' | 'sync'>('map');

  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);
  const [printMapImage, setPrintMapImage] = useState<string | null>(null);

  // --- Helper Alert Trigger ---
  const triggerAlert = useCallback((type: 'success' | 'info', text: string) => {
    setAlertMessage({ type, text });
    setTimeout(() => {
      setAlertMessage(null);
    }, 4000);
  }, []);

  // --- Initial Load (LocalStorage + Hash URL Sharing) ---
  useEffect(() => {
    // 1. Resolve the starting grid configuration
    let initialSettings = DEFAULT_SETTINGS;
    const storedSettings = localStorage.getItem('castle_battle_settings');
    if (storedSettings) {
      try {
        initialSettings = JSON.parse(storedSettings);
      } catch (e) {
        console.error('Failed to parse settings from storage', e);
      }
    }

    // 2. A shared layout in the URL hash takes priority over stored leads
    const hash = window.location.hash.substring(1);
    const decodedShared = deserializeLayout(hash);
    if (decodedShared) {
      initialize({ leads: decodedShared.leads, settings: decodedShared.settings });
      triggerAlert('success', 'Shared layout successfully loaded from link!');
      return;
    }

    // 3. Otherwise load the stored roster, or seed a first-run demo preset
    const storedLeads = localStorage.getItem('castle_battle_leads');
    if (storedLeads) {
      try {
        initialize({ leads: JSON.parse(storedLeads), settings: initialSettings });
        return;
      } catch (e) {
        console.error('Failed to parse leads from storage', e);
      }
    }

    // First-run: populate and auto-place the elegant 5-lead preset
    const firstLeads = DEMO_PRESET_DEFAULT.map((item, index) => ({
      ...item,
      id: `lead-init-${index}`,
    }));
    initialize({ leads: assignPositions(firstLeads, initialSettings), settings: initialSettings });
  }, [initialize, triggerAlert]);

  // Clean up premium printed picture on conclusion of printing session
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintMapImage(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // --- Undo / Redo keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      // Don't hijack native undo/redo while typing in a field
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // --- Rally Lead Mutation Actions ---
  const handleAddLead = (newLeadData: Omit<RallyLead, 'id'>) => {
    const newLead: RallyLead = {
      ...newLeadData,
      id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setLeads((prev) => [...prev, newLead]);
    triggerAlert('success', `Added lead: "${newLead.name}"`);
  };

  const handleAddLeadsBulk = (leadsList: Array<{ name: string; priority: PriorityLevel; notes?: string }>) => {
    const formatted: RallyLead[] = leadsList.map((item, index) => ({
      ...item,
      id: `lead-bulk-${Date.now()}-${index}`,
      position: null,
      locked: false,
    }));
    setLeads((prev) => [...prev, ...formatted]);
    triggerAlert('success', `Bulk imported ${formatted.length} rally leads`);
  };

  const handleUpdateLead = (leadId: string, updates: Partial<RallyLead>) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, ...updates } : l))
    );
  };

  const handleDeleteLead = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    if (lead) {
      triggerAlert('info', `Removed lead: "${lead.name}"`);
    }
  };

  // Lock handler directly
  const handleToggleLeadLock = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const nextLocked = !lead.locked;
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, locked: nextLocked } : l))
    );
    triggerAlert('info', `Position ${nextLocked ? 'LOCKED' : 'UNLOCKED'} for "${lead.name}"`);
  };

  // --- Layout Positioning Algorithms ---
  const handleAssignPositions = () => {
    const placed = assignPositions(leads, settings);
    setLeads(placed);
    triggerAlert('success', 'Optimized circular placement mapped successfully');
  };

  const handleClearPositions = (unlockedOnly: boolean = true) => {
    setLeads((prev) =>
      prev.map((l) => {
        if (unlockedOnly && l.locked) {
          return l;
        }
        return { ...l, position: null };
      })
    );
    triggerAlert('info', unlockedOnly ? 'Unassigned flexible locations' : 'Cleared all city locations');
  };

  // Manual Drag-and-Drop Reposition & Swapping handler
  const handleUpdateLeadPosition = (
    leadId: string,
    newPos: Location2D | null,
    swapLeadId?: string
  ) => {
    const currentLead = leads.find((l) => l.id === leadId);
    if (!currentLead) return;

    // Handle swapping behavior
    if (swapLeadId) {
      const targetLead = leads.find((l) => l.id === swapLeadId);
      if (targetLead && currentLead.position && targetLead.position) {
        const currentPos = { ...currentLead.position };
        const targetPos = { ...targetLead.position };
        setLeads((prev) =>
          prev.map((l) => {
            if (l.id === leadId) return { ...l, position: targetPos };
            if (l.id === swapLeadId) return { ...l, position: currentPos };
            return l;
          })
        );
        triggerAlert('success', `Swapped positions between ${currentLead.name} & ${targetLead.name}`);
        return;
      }
    }

    // Normal dragging move
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, position: newPos } : l))
    );
  };

  // --- Saved Template management ---
  const handleSaveCurrentLayout = (name: string) => {
    const newLayout: SavedLayout = {
      id: `layout-${Date.now()}`,
      name,
      settings: { ...settings },
      leads: leads.map((l) => ({ ...l, position: l.position ? { ...l.position } : null })),
      createdAt: new Date().toISOString(),
    };
    addLayout(newLayout);
    triggerAlert('success', `Saved Layout template: "${name}"`);
  };

  const handleImportLayouts = (newLayouts: SavedLayout[]) => {
    importLayouts(newLayouts);
    triggerAlert('success', `Imported ${newLayouts.length} template(s) successfully!`);
  };

  const handleLoadLayout = (layout: SavedLayout) => {
    loadDocument({ leads: layout.leads, settings: layout.settings });
    triggerAlert('success', `Loaded Layout template: "${layout.name}"`);
  };

  const handleDeleteLayout = (id: string) => {
    const target = savedLayouts.find((l) => l.id === id);
    removeLayout(id);
    if (target) {
      triggerAlert('info', `Deleted Layout template: "${target.name}"`);
    }
  };

  // --- Preset Loaders ---
  const handleLoadDemoPreset = (presetName: 'default' | 'omega' | 'alpha') => {
    let source: Omit<RallyLead, 'id'>[] = DEMO_PRESET_DEFAULT;
    let label = 'ROSTER 1 (5 Leads)';

    if (presetName === 'omega') {
      source = DEMO_PRESET_OMEGA;
      label = 'ROSTER 2 (Heavy)';
    }

    const nextLeads = source.map((item, index) => ({
      ...item,
      id: `lead-${presetName}-${index}-${Date.now()}`,
    }));

    // Load and auto-place in a single undoable step
    loadDocument({ leads: assignPositions(nextLeads, settings), settings });
    triggerAlert('success', `Loaded demo preset ${label}`);
  };

  // --- Export Actions ---
  const handleExportCSV = () => {
    exportToCSV(leads, settings);
    triggerAlert('success', 'Rally Lead CSV downloaded successfully');
  };

  const handleExportPNG = () => {
    exportToPNG();
    triggerAlert('success', 'Rendering map to High-Res PNG download');
  };

  const handleExportPDF = async () => {
    const svgElement = document.getElementById('battle-map-svg');
    if (!svgElement) {
      triggerAlert('info', 'Launching printer area...');
      window.print();
      return;
    }
    
    try {
      triggerAlert('info', 'Rendering map layout for premium PDF/Print...');
      // Generate the high-res capture matching the preview exactly
      const pngDataUrl = await getSVGImageBytes(svgElement as unknown as SVGElement);
      setPrintMapImage(pngDataUrl);
      
      // Allow a tiny delay for React to digest state and insert img before triggering window.print()
      setTimeout(() => {
        window.print();
      }, 150);
    } catch (err) {
      console.error('Failed to prepare high-res map layout for PDF/Print:', err);
      triggerAlert('info', 'Standard printing layout triggered');
      window.print();
    }
  };

  const handleCopyShareLink = () => {
    const hashStr = serializeLayout(settings, leads);
    const shareUrl = `${window.location.origin}${window.location.pathname}#${hashStr}`;
    
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        triggerAlert('success', 'Shareable URL copied to clipboard!');
      })
      .catch((err) => {
        console.error('Could not copy string', err);
        triggerAlert('info', 'Failed to copy share link automatically');
      });
  };

  return (
    <div className="flex flex-col h-screen min-h-[600px] bg-[#070b19] font-sans antialiased text-slate-100 overflow-hidden relative">
      
      {/* Hidden print layout component. Activates during PDF/Print generation only */}
      <div id="print-area" className="hidden print:block p-10 bg-white text-black text-xs font-sans absolute inset-0 z-0">
        <div className="border-b-2 border-slate-900 pb-5 mb-5 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
              CASTLE BATTLE LAYOUT ROSTER
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Organized Rally Lead Placements around the central 12x12 Castle.
            </p>
          </div>
          <div className="text-right font-mono text-[10px] text-slate-500">
            <div>Grid System Dimensions: {settings.width}x{settings.height}</div>
            <div>Generated: {new Date().toLocaleString()}</div>
          </div>
        </div>

        {/* High-fidelity Rendered Map - Single Source of Truth matching PNG download exactly */}
        {printMapImage && (
          <div className="mb-8 flex flex-col items-center">
            <h2 className="text-xs font-bold uppercase border-b border-slate-300 w-full mb-3 pb-1 tracking-wider text-slate-850">
              Active Battlefield Strategy Map
            </h2>
            <img 
              src={printMapImage} 
              alt="Castle Strategy Map Preview" 
              className="w-full max-h-[500px] object-contain rounded-xl border border-slate-300 shadow-md bg-[#070b19]"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 items-start">
          {/* List representation */}
          <div>
            <h2 className="text-xs font-bold uppercase border-b border-dark mb-3 pb-1">
              Rally Leads List
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] font-bold text-slate-600 uppercase">
                  <th className="py-2">Rally Lead</th>
                  <th className="py-2 text-center">Priority</th>
                  <th className="py-2 text-center">Location (X, Y)</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="text-[10px]">
                    <td className="py-2 font-bold">{lead.name}</td>
                    <td className="py-2 text-center">{PriorityLevel[lead.priority]}</td>
                    <td className="py-2 text-center font-mono">
                      {lead.position ? `(${lead.position.x}, ${lead.position.y})` : 'Unassigned'}
                    </td>
                    <td className="py-2 text-slate-500 italic">{lead.notes || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase border-b border-dark pb-1">
              Rules & Strategy Context
            </h2>
            <ul className="list-disc list-inside space-y-1.5 text-slate-600">
              <li>Every city occupies a 2x2 square aligned to the grid.</li>
              <li>Closest positions outer castle edge are preferred.</li>
              <li>L1 (Highest Priority) leads are sorted closest first.</li>
              <li>Coordinate layout has been locked and visually verified.</li>
            </ul>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-5">
              <h3 className="text-[10px] font-mono font-bold text-slate-800 uppercase tracking-wider mb-2">
                Coordinates Key Summary
              </h3>
              <div className="space-y-1 text-[9px] font-mono text-slate-650 max-h-40 overflow-hidden">
                {leads.filter(l => l.position).map((lead) => (
                  <div key={lead.id}>
                    • {lead.name}: <b>({lead.position!.x}, {lead.position!.y})</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Frame - Hide during print */}
      <div className="flex-1 flex flex-col h-full overflow-hidden print:hidden no-print">
        {/* Global Toolbar Header */}
        <Header
          settings={settings}
          savedLayouts={savedLayouts}
          onUpdateSettings={setSettings}
          onSaveCurrentLayout={handleSaveCurrentLayout}
          onLoadLayout={handleLoadLayout}
          onDeleteLayout={handleDeleteLayout}
          onLoadDemoPreset={handleLoadDemoPreset}
          onImportLayouts={handleImportLayouts}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Dynamic feedback messages alerts popup */}
        {alertMessage && (
          <div className={`absolute top-16 right-6 z-40 bg-slate-900/95 border rounded-xl px-4 py-2.5 shadow-2xl backdrop-blur flex items-center gap-2 text-xs font-semibold max-w-sm animate-bounce ${alertMessage.type === 'success' ? 'border-emerald-500/30' : 'border-indigo-500/30'}`}>
            {alertMessage.type === 'success' ? (
              <CheckSquare className="text-emerald-400 shrink-0" size={14} />
            ) : (
              <Info className="text-indigo-400 shrink-0" size={14} />
            )}
            <span className="text-slate-200 truncate">{alertMessage.text}</span>
          </div>
        )}

        <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden">
          
          {/* Sidebar Left Panel (Roster Control, Bulk Paste) */}
          <div className="w-full lg:w-[380px] shrink-0 h-[400px] lg:h-full">
            <LeadPanel
              leads={leads}
              settings={settings}
              onAddLead={handleAddLead}
              onAddLeadsBulk={handleAddLeadsBulk}
              onUpdateLead={handleUpdateLead}
              onToggleLeadLock={handleToggleLeadLock}
              onDeleteLead={handleDeleteLead}
              onAssignPositions={handleAssignPositions}
              onClearPositions={handleClearPositions}
              onExportCSV={handleExportCSV}
              onExportPNG={handleExportPNG}
              onExportPDF={handleExportPDF}
              onCopyShareLink={handleCopyShareLink}
              onUpdateSettings={setSettings}
            />
          </div>

          {/* Interactive Strategy Map Right Workspace */}
          <div className="flex-1 h-full min-h-0 flex flex-col gap-3">
            {/* View tabs */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-850 rounded-xl p-1 self-start shrink-0">
              <button
                onClick={() => setActiveView('map')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  activeView === 'map'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MapIcon size={13} />
                Map Planner
              </button>
              <button
                onClick={() => setActiveView('sync')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  activeView === 'sync'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap size={13} />
                Rally Sync
                {rallyGroups.length > 0 && (
                  <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
                    {rallyGroups.length}
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 min-h-0">
              {activeView === 'map' ? (
                <CastleMap
                  leads={leads}
                  settings={settings}
                  onUpdateLeadPosition={handleUpdateLeadPosition}
                  onToggleLeadLock={handleToggleLeadLock}
                />
              ) : (
                <RallySyncPanel
                  groups={rallyGroups}
                  leads={leads}
                  settings={settings}
                  onAddGroup={addRallyGroup}
                  onRenameGroup={renameRallyGroup}
                  onRemoveGroup={removeRallyGroup}
                  onToggleMember={toggleRallyMember}
                  onToggleMemberPet={toggleRallyMemberPet}
                  onSetAllPets={setRallyAllPets}
                  onStartSequence={startRallySequence}
                  onStopSequence={stopRallySequence}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

