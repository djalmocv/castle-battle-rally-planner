import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Map, 
  Save, 
  FolderOpen, 
  Trash2, 
  Sparkles,
  Download,
  Upload,
  Undo2,
  Redo2
} from 'lucide-react';
import { GridSettings, SavedLayout } from '../types';

interface HeaderProps {
  settings: GridSettings;
  savedLayouts: SavedLayout[];
  onUpdateSettings: (settings: GridSettings) => void;
  onSaveCurrentLayout: (name: string) => void;
  onLoadLayout: (layout: SavedLayout) => void;
  onDeleteLayout: (id: string) => void;
  onLoadDemoPreset: (presetName: 'default' | 'omega' | 'alpha') => void;
  onImportLayouts: (layouts: SavedLayout[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function Header({
  settings,
  savedLayouts,
  onUpdateSettings,
  onSaveCurrentLayout,
  onLoadLayout,
  onDeleteLayout,
  onLoadDemoPreset,
  onImportLayouts,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: HeaderProps) {
  // Modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);

  // Backup and restore handlers
  const handleExportTemplates = () => {
    if (savedLayouts.length === 0) {
      alert("You don't have any saved templates to backup yet!");
      return;
    }
    try {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(savedLayouts, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `warboard_templates_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error(err);
      alert('Failed to generate template backup file.');
    }
  };

  const handleImportTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const incoming = Array.isArray(parsed) ? parsed : [parsed];
        const sanitized: SavedLayout[] = [];

        for (const item of incoming) {
          if (item && typeof item === 'object' && item.name && Array.isArray(item.leads)) {
            sanitized.push({
              id: item.id || `layout-import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              name: item.name,
              settings: item.settings || settings,
              leads: item.leads,
              createdAt: item.createdAt || new Date().toISOString(),
            });
          }
        }

        if (sanitized.length > 0) {
          onImportLayouts(sanitized);
          e.target.value = ''; // Reset file input
        } else {
          alert('No valid template structures found in the uploaded file.');
        }
      } catch (err) {
        console.error(err);
        alert('Invalid file format. Please upload a valid .json template backup file.');
      }
    };
    reader.readAsText(file);
  };

  // Settings inputs
  const [gridWidth, setGridWidth] = useState(settings.width);
  const [gridHeight, setGridHeight] = useState(settings.height);
  const [castleSize, setCastleSize] = useState(settings.castleSize);
  const [castleX, setCastleX] = useState(settings.castleX);
  const [castleY, setCastleY] = useState(settings.castleY);
  const [snapMode, setSnapMode] = useState<'2x2' | '1x1'>(settings.snapMode);

  // New Save input
  const [layoutNameInput, setLayoutNameInput] = useState('');

  // Keep the settings form in sync with the latest settings whenever the
  // modal opens (e.g. after loading a saved template), so inputs never show
  // stale values from a previous render.
  useEffect(() => {
    if (showSettingsModal) {
      setGridWidth(settings.width);
      setGridHeight(settings.height);
      setCastleSize(settings.castleSize);
      setCastleX(settings.castleX);
      setCastleY(settings.castleY);
      setSnapMode(settings.snapMode);
    }
  }, [showSettingsModal, settings]);

  // Apply new settings
  const handleApplySettings = (e: React.FormEvent) => {
    e.preventDefault();

    // Bounds sanitization
    const w = Math.max(16, Math.min(64, gridWidth));
    const h = Math.max(16, Math.min(64, gridHeight));
    const size = Math.max(4, Math.min(Math.min(w, h) - 4, castleSize));
    
    // Ensure castle sits in the center or valid coordinates
    const cx = Math.max(0, Math.min(w - size, castleX));
    const cy = Math.max(0, Math.min(h - size, castleY));

    onUpdateSettings({
      ...settings,
      width: w,
      height: h,
      castleSize: size,
      castleX: cx,
      castleY: cy,
      snapMode,
    });

    setShowSettingsModal(false);
  };

  // Center Castle position dynamically based on grid
  const handleAutoCenterCastle = () => {
    const size = castleSize;
    const cx = Math.floor((gridWidth - size) / 2);
    const cy = Math.floor((gridHeight - size) / 2);
    setCastleX(cx);
    setCastleY(cy);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!layoutNameInput.trim()) return;
    onSaveCurrentLayout(layoutNameInput.trim());
    setLayoutNameInput('');
    setShowSaveModal(false);
  };

  return (
    <>
      <header className="bg-slate-950/85 border-b border-slate-800 backdrop-blur px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 z-30 relative select-none">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-red-600 via-pink-600 to-indigo-600 p-2.5 rounded-xl shadow-lg ring-1 ring-white/10">
          <Map className="text-white" size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-wide text-white">
              WARBOARD
            </h1>
            <span className="text-[9px] bg-red-950 text-red-400 font-extrabold border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Battle Planner
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            Auto-assignment & map editor for Castle Rally configurations
          </p>
        </div>
      </div>

      {/* Primary Global Controls Header bar */}
      <div className="flex flex-wrap items-center gap-2/5">

        {/* Undo / Redo history controls */}
        <div className="flex items-center bg-slate-900 border border-slate-850 rounded-xl p-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="px-2.5 py-1.5 hover:bg-slate-850 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-300"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={12} className="text-indigo-400" />
            Undo
          </button>
          <div className="h-4 w-[1px] bg-slate-800" />
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="px-2.5 py-1.5 hover:bg-slate-850 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-300"
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 size={12} className="text-indigo-400" />
            Redo
          </button>
        </div>

        <div className="h-5 w-[1px] bg-slate-800 hidden md:block" />

        {/* Load Demopresents dropdown */}
        <div className="flex items-center bg-slate-900 border border-slate-850 rounded-xl p-0.5">
          <button
            onClick={() => onLoadDemoPreset('default')}
            className="px-2.5 py-1.5 hover:bg-slate-850 text-slate-300 hover:text-white rounded-lg text-xs font-bold font-sans transition flex items-center gap-1 cursor-pointer"
            title="Load Default 5 Leads Preset"
          >
            <Sparkles size={12} className="text-amber-400" />
            Roster 1 (5 Leads)
          </button>
          <div className="h-4 w-[1px] bg-slate-800" />
          <button
            onClick={() => onLoadDemoPreset('omega')}
            className="px-2.5 py-1.5 hover:bg-slate-850 text-slate-300 hover:text-white rounded-lg text-xs font-bold font-sans transition flex items-center gap-1 cursor-pointer"
            title="Load Heavy 18 Leads Preset"
          >
            <Sparkles size={12} className="text-purple-400" />
            Roster 2 (Heavy)
          </button>
        </div>

        <div className="h-5 w-[1px] bg-slate-800 hidden md:block" />

        {/* Load layout */}
        <button
          onClick={() => setShowLoadModal(true)}
          className="bg-slate-900 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 text-slate-300 hover:text-white rounded-xl px-3.5 py-2 text-xs font-extrabold transition flex items-center gap-2 cursor-pointer"
        >
          <FolderOpen size={14} className="text-indigo-400" />
          <span>My Templates <b className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded ml-1 font-mono">{savedLayouts.length}</b></span>
        </button>

        {/* Save Current layout */}
        <button
          onClick={() => setShowSaveModal(true)}
          className="bg-slate-900 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 text-slate-300 hover:text-white rounded-xl px-3.5 py-2 text-xs font-extrabold transition flex items-center gap-2 cursor-pointer"
        >
          <Save size={14} className="text-indigo-400" />
          <span>Save Layout</span>
        </button>

        {/* Map dimensions setting */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 hover:text-indigo-200 rounded-xl px-3.5 py-2 text-xs font-extrabold transition flex items-center gap-2 cursor-pointer"
          title="Grid Config"
        >
          <Settings size={14} className="animate-spin-slow" />
          <span>Grid Config</span>
        </button>
      </div>
    </header>

    {/* Grid Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form onSubmit={handleApplySettings} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase text-white tracking-wider flex items-center gap-2">
                <Settings className="text-indigo-400" size={16} />
                Grid & Castle Setup
              </h3>
              <button 
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Config Fields */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    Grid Width (16-64)
                  </label>
                  <input
                    type="number"
                    min={16}
                    max={64}
                    value={gridWidth}
                    onChange={(e) => setGridWidth(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    Grid Height (16-64)
                  </label>
                  <input
                    type="number"
                    min={16}
                    max={64}
                    value={gridHeight}
                    onChange={(e) => setGridHeight(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Castle Size (W x H)
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoCenterCastle}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Auto Center Castle
                  </button>
                </div>
                <input
                  type="number"
                  min={4}
                  max={24}
                  value={castleSize}
                  onChange={(e) => setCastleSize(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
                <p className="text-[9px] text-slate-500 mt-1">Recommended size for castle is 12x12</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    Castle Left X
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={castleX}
                    onChange={(e) => setCastleX(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    Castle Top Y
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={castleY}
                    onChange={(e) => setCastleY(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Align snapping mode */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  City Placement Snapping
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-850">
                  <button
                    type="button"
                    onClick={() => setSnapMode('2x2')}
                    className={`py-1.5 rounded text-[11px] font-bold ${
                      snapMode === '2x2' 
                        ? 'bg-indigo-650 text-white shadow' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    2x2 Aligned Rows
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnapMode('1x1')}
                    className={`py-1.5 rounded text-[11px] font-bold ${
                      snapMode === '1x1' 
                        ? 'bg-indigo-650 text-white shadow' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Dense 1x1 Free snap
                  </button>
                </div>
                <p className="text-[9px] text-slate-500 mt-1.5">
                  2x2 Aligned Rows forces cities on even grid cells only, keeping cities perfectly stacked.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 border border-slate-800 text-slate-400 rounded-xl font-bold text-xs hover:bg-slate-850"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-xs"
              >
                Apply Layout Setup
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Save Layout Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form onSubmit={handleSaveSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase text-white tracking-wider flex items-center gap-2">
                <Save className="text-indigo-400" size={16} />
                Save New Template
              </h3>
              <button 
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                Template Name
              </label>
              <input
                type="text"
                required
                value={layoutNameInput}
                onChange={(e) => setLayoutNameInput(e.target.value)}
                placeholder="e.g. June Monthly War Layout"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-750 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 border border-slate-800 text-slate-400 rounded-xl font-bold text-xs hover:bg-slate-850"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs"
              >
                Save Layout
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Load Templates Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col p-6 space-y-3.5 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-extrabold uppercase text-white tracking-wider flex items-center gap-2">
                <FolderOpen className="text-indigo-400" size={16} />
                Saved Templates ({savedLayouts.length})
              </h3>
              <button 
                onClick={() => setShowLoadModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Backup & Restore Action Bar */}
            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-800/80 flex-shrink-0">
              <button
                type="button"
                onClick={handleExportTemplates}
                className="py-2 px-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                title="Export all saved templates to a backup JSON file"
              >
                <Download size={13} className="text-indigo-400" />
                Backup Layouts (.json)
              </button>
              <label
                className="py-2 px-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer text-center transition"
                title="Import backups from a JSON file"
              >
                <Upload size={13} className="text-indigo-400" />
                Restore Layouts
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportTemplates}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
              {savedLayouts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No saved templates found. Create and save layout configs to see them here!
                </div>
              ) : (
                savedLayouts.map((layout) => (
                  <div 
                    key={layout.id} 
                    className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-850 hover:border-slate-700/60 rounded-xl transition gap-3"
                  >
                    <div 
                      onClick={() => {
                        onLoadLayout(layout);
                        setShowLoadModal(false);
                      }}
                      className="cursor-pointer flex-1 text-left min-w-0"
                    >
                      <h4 className="text-xs font-bold text-slate-200 truncate">{layout.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {layout.leads.length} leads • {layout.settings.width}x{layout.settings.height} • {layout.settings.snapMode}
                      </p>
                    </div>

                    <button
                      onClick={() => onDeleteLayout(layout.id)}
                      className="text-slate-600 hover:text-red-400 p-1.5 transition"
                      title="Delete Saved Template"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-850 flex-shrink-0">
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 border border-slate-800 text-slate-400 rounded-xl font-bold text-xs hover:bg-slate-850"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
