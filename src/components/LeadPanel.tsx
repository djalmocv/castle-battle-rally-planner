import React, { useState } from 'react';
import { 
  Users, 
  Trash2, 
  Lock, 
  Unlock, 
  UserPlus, 
  FileSpreadsheet, 
  Download, 
  Share2, 
  Compass, 
  Edit2, 
  Check, 
  FileText,
  LayoutGrid,
  Clock,
  Sparkles
} from 'lucide-react';
import { RallyLead, PriorityLevel, GridSettings } from '../types';
import { getDistanceToCastle } from '../utils/assignment';
import { getMarchTimeToCastle, formatMarchTime } from '../utils/march';
import { PET_TIME_SLOTS, DEFAULT_PET_SLOT_ID, getPriorityStyle } from '../constants';

interface LeadPanelProps {
  leads: RallyLead[];
  settings: GridSettings;
  onAddLead: (lead: Omit<RallyLead, 'id'>) => void;
  onAddLeadsBulk: (leadsData: Array<{ name: string; priority: PriorityLevel; notes?: string }>) => void;
  onUpdateLead: (leadId: string, updates: Partial<RallyLead>) => void;
  onToggleLeadLock: (leadId: string) => void;
  onDeleteLead: (leadId: string) => void;
  onAssignPositions: () => void;
  onClearPositions: (unlockedOnly: boolean) => void;
  onExportCSV: () => void;
  onExportPNG: () => void;
  onExportPDF: () => void;
  onCopyShareLink: () => void;
  onUpdateSettings: (settings: GridSettings) => void;
}

export default function LeadPanel({
  leads,
  settings,
  onAddLead,
  onAddLeadsBulk,
  onUpdateLead,
  onToggleLeadLock,
  onDeleteLead,
  onAssignPositions,
  onClearPositions,
  onExportCSV,
  onExportPNG,
  onExportPDF,
  onCopyShareLink,
  onUpdateSettings,
}: LeadPanelProps) {
  // Input Form States
  const [nameInput, setNameInput] = useState('');
  const [priorityInput, setPriorityInput] = useState<PriorityLevel>(PriorityLevel.Normal);
  const [notesInput, setNotesInput] = useState('');
  const [usesPetInput, setUsesPetInput] = useState(false);
  const [onlineForSvsInput, setOnlineForSvsInput] = useState(true);

  // Bulk Import modal states
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTextInput, setBulkTextInput] = useState('');

  // Edit inline states
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPriority, setEditingPriority] = useState<PriorityLevel>(PriorityLevel.Normal);
  const [editingNotes, setEditingNotes] = useState('');
  const [editingUsesPet, setEditingUsesPet] = useState(false);
  const [editingPetSlotId, setEditingPetSlotId] = useState(DEFAULT_PET_SLOT_ID);
  const [editingOnlineForSvs, setEditingOnlineForSvs] = useState(true);

  // Search/Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned' | 'locked'>('all');

  // Share status feedback
  const [justCopied, setJustCopied] = useState(false);

  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    onAddLead({
      name: nameInput.trim(),
      priority: priorityInput,
      notes: notesInput.trim() || undefined,
      position: null,
      locked: false,
      usesPet: usesPetInput,
      petSlotId: usesPetInput ? DEFAULT_PET_SLOT_ID : undefined,
      onlineForSvs: onlineForSvsInput,
    });

    setNameInput('');
    setNotesInput('');
    setPriorityInput(PriorityLevel.Normal);
    setUsesPetInput(false);
    setOnlineForSvsInput(true);
  };

  // Bulk Process Parser
  const handleBulkImport = () => {
    if (!bulkTextInput.trim()) return;

    const list: Array<{ name: string; priority: PriorityLevel; notes?: string }> = [];
    const lines = bulkTextInput.split('\n');

    lines.forEach((line) => {
      const sanitized = line.trim();
      if (!sanitized) return;

      // Format supported: "Name, Priority X, Notes" or just "Name, Priority X" or just "Name"
      const parts = sanitized.split(',');
      const rawName = parts[0].trim();
      if (!rawName) return;

      let priority = PriorityLevel.Normal;
      let notes = '';

      if (parts.length > 1) {
        const rawPriority = parts[1].toLowerCase();
        if (rawPriority.includes('highest') || rawPriority.includes('level 1') || rawPriority.includes('priority 1')) {
          priority = PriorityLevel.Highest;
        } else if (rawPriority.includes('high') || rawPriority.includes('level 2') || rawPriority.includes('priority 2')) {
          priority = PriorityLevel.High;
        } else if (rawPriority.includes('normal') || rawPriority.includes('level 3') || rawPriority.includes('priority 3')) {
          priority = PriorityLevel.Normal;
        } else if (rawPriority.includes('low') || rawPriority.includes('level 4') || rawPriority.includes('priority 4')) {
          priority = PriorityLevel.Low;
        } else if (rawPriority.includes('lowest') || rawPriority.includes('level 5') || rawPriority.includes('priority 5')) {
          priority = PriorityLevel.Lowest;
        }
      }

      if (parts.length > 2) {
        notes = parts.slice(2).join(',').trim();
      }

      list.push({
        name: rawName,
        priority,
        notes: notes || undefined,
      });
    });

    if (list.length > 0) {
      onAddLeadsBulk(list);
    }

    setBulkTextInput('');
    setShowBulkModal(false);
  };

  // Save edits
  const handleSaveEdit = (leadId: string) => {
    if (!editingName.trim()) return;
    onUpdateLead(leadId, {
      name: editingName.trim(),
      priority: editingPriority,
      notes: editingNotes.trim() || undefined,
      usesPet: editingUsesPet,
      petSlotId: editingPetSlotId,
      onlineForSvs: editingOnlineForSvs,
    });
    setEditingLeadId(null);
  };

  const startEditing = (lead: RallyLead) => {
    setEditingLeadId(lead.id);
    setEditingName(lead.name);
    setEditingPriority(lead.priority);
    setEditingNotes(lead.notes || '');
    setEditingUsesPet(!!lead.usesPet);
    setEditingPetSlotId(lead.petSlotId || DEFAULT_PET_SLOT_ID);
    setEditingOnlineForSvs(lead.onlineForSvs !== false);
  };

  // Filter functionality
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (lead.notes && lead.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPriority = filterPriority === 'all' || lead.priority.toString() === filterPriority;
    
    let matchesStatus = true;
    if (filterStatus === 'assigned') matchesStatus = lead.position !== null;
    if (filterStatus === 'unassigned') matchesStatus = lead.position === null;
    if (filterStatus === 'locked') matchesStatus = lead.locked;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  const handleCopyTrigger = () => {
    onCopyShareLink();
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Dynamic Header actions */}
      <div className="p-5 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-indigo-400" size={18} />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Rally Leads ({leads.length})
            </h2>
          </div>
          
          <button
            onClick={() => setShowBulkModal(true)}
            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet size={13} />
            Bulk Paste
          </button>
        </div>

        {/* Placement side selector option */}
        <div className="space-y-1.5 bg-slate-950/40 p-2 border border-slate-900 rounded-xl">
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
            <span>Auto-Position Side</span>
            <span className="text-[9px] text-indigo-400 font-mono italic">oriented to 45° top corner</span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-900/60">
            <button
              onClick={() => onUpdateSettings({ ...settings, autoSide: 'both' })}
              className={`py-1 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                settings.autoSide === 'both' || !settings.autoSide
                  ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/30 font-extrabold'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              Both Sides
            </button>
            <button
              onClick={() => onUpdateSettings({ ...settings, autoSide: 'left' })}
              className={`py-1 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                settings.autoSide === 'left'
                  ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/30 font-extrabold'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              Left Side
            </button>
            <button
              onClick={() => onUpdateSettings({ ...settings, autoSide: 'right' })}
              className={`py-1 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                settings.autoSide === 'right'
                  ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/30 font-extrabold'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              Right Side
            </button>
          </div>
        </div>

        {/* Quick layout generation trigger */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAssignPositions}
            disabled={leads.length === 0}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800/50 disabled:text-slate-500 text-white rounded-xl font-bold text-xs select-none shadow-lg shadow-indigo-900/20 active:translate-y-px transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Compass size={14} className="animate-spin-slow" />
            AUTO POSITION
          </button>
          
          <button
            onClick={() => onClearPositions(true)}
            disabled={leads.filter(l => l.position).length === 0}
            className="w-full h-11 bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:border-slate-900 disabled:text-slate-600 text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
          >
            Clear Open
          </button>
        </div>
      </div>

      {/* 1. Add Single Lead Form */}
      <div className="p-4 bg-slate-900/30 border-b border-slate-900">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
            Quick Add Lead
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <input
                type="text"
                placeholder="Name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 outline-none transition"
              />
            </div>
            
            <div>
              <select
                value={priorityInput}
                onChange={(e) => setPriorityInput(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-1.5 py-1.5 text-xs text-slate-300 outline-none transition"
              >
                <option value={PriorityLevel.Highest}>L1 Max</option>
                <option value={PriorityLevel.High}>L2 High</option>
                <option value={PriorityLevel.Normal}>L3 Mid</option>
                <option value={PriorityLevel.Low}>L4 Low</option>
                <option value={PriorityLevel.Lowest}>L5 Min</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Notes / Alliance (optional)"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 outline-none transition"
            />
            <button
              type="submit"
              className="bg-indigo-650/40 hover:bg-indigo-600 text-indigo-300 hover:text-white px-3.5 py-1 rounded-lg border border-indigo-500/20 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <UserPlus size={13} />
              Add
            </button>
          </div>

          <div className="flex items-center gap-4 text-[10px] text-slate-400 pl-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlineForSvsInput}
                onChange={(e) => setOnlineForSvsInput(e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 bg-slate-900 border-slate-800 rounded focus:ring-indigo-500 accent-indigo-500"
              />
              <span className="flex items-center gap-1 font-semibold">
                <span className={`w-1.5 h-1.5 rounded-full ${onlineForSvsInput ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                Online for SvS
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={usesPetInput}
                onChange={(e) => setUsesPetInput(e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 bg-slate-900 border-slate-800 rounded focus:ring-indigo-500 accent-indigo-500"
              />
              <span className="flex items-center gap-1 font-semibold">
                <Sparkles size={10} className="text-orange-400/80" />
                Uses Pet Buff
              </span>
            </label>
          </div>
        </form>
      </div>

      {/* Filters Area */}
      <div className="p-3.5 bg-slate-900/60 border-b border-slate-900/80 space-y-2">
        <input
          type="text"
          placeholder="Filter leads name or note..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-slate-600 outline-none transition"
        />

        <div className="grid grid-cols-2 gap-1.5">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-[10px] text-slate-400 px-1 py-1 rounded outline-none transition"
          >
            <option value="all">Any Priority</option>
            <option value={PriorityLevel.Highest.toString()}>L1 (Highest)</option>
            <option value={PriorityLevel.High.toString()}>L2 (High)</option>
            <option value={PriorityLevel.Normal.toString()}>L3 (Normal)</option>
            <option value={PriorityLevel.Low.toString()}>L4 (Low)</option>
            <option value={PriorityLevel.Lowest.toString()}>L5 (Lowest)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-[10px] text-slate-400 px-1 py-1 rounded outline-none transition"
          >
            <option value="all">Any Placement</option>
            <option value="assigned">Assigned Only</option>
            <option value="unassigned">Unassigned Only</option>
            <option value="locked">Locked Only</option>
          </select>
        </div>
      </div>

      {/* 2. Roster List scroll container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[180px]">
        {filteredLeads.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 py-10 space-y-1.5">
            <LayoutGrid size={28} className="stroke-1" />
            <p className="text-xs font-semibold">No leads found matching query</p>
            <p className="text-[10px] max-w-[170px]">Add leads above or click bulk paste to populate.</p>
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const isEditing = editingLeadId === lead.id;
            const hasPosition = lead.position !== null;
            const dist = hasPosition ? getDistanceToCastle(lead.position!.x, lead.position!.y, settings) : null;
            const marchSeconds = hasPosition
              ? getMarchTimeToCastle(lead.position!.x, lead.position!.y, settings, !!lead.usesPet)
              : null;
            const isOffline = lead.onlineForSvs === false;

            return (
              <div 
                key={lead.id} 
                className={`p-3 rounded-xl border transition duration-150 ${
                  isOffline
                    ? 'bg-slate-950/30 border-slate-900 text-slate-400 opacity-60'
                    : lead.position 
                      ? 'bg-slate-900/40 border-slate-800/80' 
                      : 'bg-amber-950/5 border-amber-900/10'
                }`}
              >
                {/* Inline Editing Layout */}
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                      placeholder="Name"
                    />

                    <div className="grid grid-cols-2 gap-1">
                      <select
                        value={editingPriority}
                        onChange={(e) => setEditingPriority(Number(e.target.value))}
                        className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-300"
                      >
                        <option value={PriorityLevel.Highest}>Highest (1)</option>
                        <option value={PriorityLevel.High}>High (2)</option>
                        <option value={PriorityLevel.Normal}>Normal (3)</option>
                        <option value={PriorityLevel.Low}>Low (4)</option>
                        <option value={PriorityLevel.Lowest}>Lowest (5)</option>
                      </select>

                      <input
                        type="text"
                        value={editingNotes}
                        onChange={(e) => setEditingNotes(e.target.value)}
                        placeholder="Notes"
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-white"
                      />
                    </div>

                    <div className="flex flex-col gap-2 bg-slate-950/40 p-2 border border-slate-900 rounded-lg">
                      <div className="flex items-center gap-4 text-[10px]">
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
                          <input
                            type="checkbox"
                            checked={editingOnlineForSvs}
                            onChange={(e) => setEditingOnlineForSvs(e.target.checked)}
                            className="w-3.5 h-3.5 text-indigo-600 bg-slate-950 border-slate-850 rounded focus:ring-indigo-500 accent-indigo-500"
                          />
                          <span className="font-semibold flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${editingOnlineForSvs ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                            Online for SvS
                          </span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
                          <input
                            type="checkbox"
                            checked={editingUsesPet}
                            onChange={(e) => setEditingUsesPet(e.target.checked)}
                            className="w-3.5 h-3.5 text-indigo-600 bg-slate-950 border-slate-850 rounded focus:ring-indigo-500 accent-indigo-500"
                          />
                          <span className="font-semibold flex items-center gap-1">
                            <Sparkles size={10} className="text-orange-400" />
                            Uses Pet
                          </span>
                        </label>
                      </div>

                      {editingUsesPet && (
                        <div className="flex items-center gap-1.5 text-[10px] border-t border-slate-900/60 pt-1.5 mt-0.5">
                          <span className="text-slate-500 font-extrabold uppercase font-mono text-[9px]">Slot:</span>
                          <select
                            value={editingPetSlotId}
                            onChange={(e) => setEditingPetSlotId(e.target.value)}
                            className="bg-slate-950 border border-slate-850 rounded px-1.5 py-0.5 text-[10px] text-orange-300 font-bold outline-none cursor-pointer hover:border-slate-700 font-mono"
                          >
                            {PET_TIME_SLOTS.map(slot => (
                              <option key={slot.id} value={slot.id} className="bg-slate-950 font-mono text-[10px]">
                                {slot.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => setEditingLeadId(null)}
                        className="text-[10px] text-slate-400 px-2 py-1 hover:bg-slate-800 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(lead.id)}
                        className="text-[10px] bg-emerald-600 text-white font-bold px-2.5 py-1 rounded hover:bg-emerald-500 flex items-center gap-1"
                      >
                        <Check size={10} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard List Row */
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-white truncate max-w-[125px]">
                            {lead.name}
                          </span>
                          
                          {/* Priority Tag */}
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded border uppercase tracking-wider ${getPriorityStyle(lead.priority).listBadgeClass}`}>
                            L{lead.priority}
                          </span>
                        </div>

                        {/* Notes */}
                        {lead.notes && (
                          <div className="text-[10px] text-indigo-400/80 italic font-medium truncate mt-0.5">
                            {lead.notes}
                          </div>
                        )}

                        {/* Pet rotation selector - directly below notes */}
                        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 hover:text-slate-300 select-none">
                            <input
                              type="checkbox"
                              checked={lead.onlineForSvs !== false}
                              onChange={(e) => {
                                onUpdateLead(lead.id, { onlineForSvs: e.target.checked });
                              }}
                              className="w-3 h-3 text-indigo-600 bg-slate-950 border-slate-850 rounded focus:ring-indigo-500 accent-indigo-500"
                            />
                            <span className="font-semibold flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${lead.onlineForSvs !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                              Online for SvS
                            </span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 hover:text-slate-300 select-none">
                            <input
                              type="checkbox"
                              checked={!!lead.usesPet}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                onUpdateLead(lead.id, { 
                                  usesPet: checked,
                                  petSlotId: lead.petSlotId || DEFAULT_PET_SLOT_ID
                                });
                              }}
                              className="w-3 h-3 text-indigo-600 bg-slate-950 border-slate-850 rounded focus:ring-indigo-500 accent-indigo-500"
                            />
                            <span className="font-semibold flex items-center gap-1">
                              <Sparkles size={10} className="text-orange-400/80" />
                              Uses Pet
                            </span>
                          </label>

                          {lead.usesPet && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-slate-500 font-extrabold uppercase font-mono">Slot:</span>
                              <select
                                value={lead.petSlotId || DEFAULT_PET_SLOT_ID}
                                onChange={(e) => {
                                  onUpdateLead(lead.id, { petSlotId: e.target.value });
                                }}
                                className="bg-slate-950/80 border border-slate-850 rounded px-1.5 py-0.5 text-[9px] text-orange-300 font-extrabold cursor-pointer hover:border-slate-700 font-mono outline-none"
                              >
                                {PET_TIME_SLOTS.map(slot => (
                                  <option key={slot.id} value={slot.id} className="bg-slate-950 font-mono text-[9px]">
                                    {slot.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Row Icon Actions */}
                      <div className="flex items-center gap-1">
                        {/* Lock toggle */}
                        <button
                          onClick={() => onToggleLeadLock(lead.id)}
                          className={`p-1 rounded hover:bg-slate-800 transition ${
                            lead.locked ? 'text-red-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title={lead.locked ? 'Unlock' : 'Lock position'}
                        >
                          {lead.locked ? <Lock size={12} strokeWidth={2.5} /> : <Unlock size={12} />}
                        </button>

                        {/* Edit Inline toggle */}
                        <button
                          onClick={() => startEditing(lead)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition"
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>

                        {/* Delete single */}
                        <button
                          onClick={() => onDeleteLead(lead.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-red-400 transition"
                          title="Remove Lead"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Footer Stats Row (Position mapping readout) */}
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-slate-900/60 pt-1.5 mt-1 text-slate-500">
                      <div>
                        {hasPosition ? (
                          <span className="text-emerald-400">
                            COORD: <b>({lead.position!.x}, {lead.position!.y})</b>
                          </span>
                        ) : (
                          <span className="text-amber-500/85">UNASSIGNED</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {hasPosition && marchSeconds !== null && (
                          <span
                            className="text-indigo-300"
                            title={`March to castle at ${lead.usesPet ? '55% (with pet)' : '25% (no pet)'} speed`}
                          >
                            MARCH: <b className="text-indigo-200">{formatMarchTime(marchSeconds)}</b>
                          </span>
                        )}
                        {hasPosition && dist && (
                          <span>DIST: <b className="text-slate-300">{dist.toFixed(1)} cells</b></span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Rotations Coverage Summary QoL Display */}
        {leads.some(l => l.usesPet) && (
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900/80 space-y-2 mt-4">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-400 tracking-wider">
              <Clock className="text-orange-400" size={13} />
              <span>Pet Rotation Coverage</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PET_TIME_SLOTS.map((slot) => {
                const leadsInSlot = leads.filter(l => l.usesPet && l.petSlotId === slot.id);
                return (
                  <div key={slot.id} className="bg-slate-900/50 p-2 rounded-lg border border-slate-900/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300 font-mono">{slot.label.split(' ')[0]}</span>
                      <span className="text-[10px] font-black font-mono text-orange-400 bg-orange-950/40 px-1.5 py-0.2 rounded border border-orange-500/15">
                        {leadsInSlot.length}
                      </span>
                    </div>
                    {leadsInSlot.length > 0 ? (
                      <div className="text-[9px] text-slate-400 font-semibold truncate mt-1">
                        {leadsInSlot.map(l => l.name).join(', ')}
                      </div>
                    ) : (
                      <div className="text-[9px] text-slate-600 italic mt-1 font-medium">None assigned</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Export / Global Controls Footer */}
      <div className="p-4 bg-slate-900 border-t border-slate-850 space-y-2">
        <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider pb-1">
          Export Layout
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {/* CSV Download */}
          <button
            onClick={onExportCSV}
            className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-[11px] font-bold text-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet size={13} className="text-indigo-400" />
            Roster CSV
          </button>
          
          {/* Map PNG Download */}
          <button
            onClick={onExportPNG}
            className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-[11px] font-bold text-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Download size={13} className="text-indigo-400" />
            Map PNG
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Print/PDF */}
          <button
            onClick={onExportPDF}
            className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-[11px] font-bold text-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Saves map as Printable PDF Layout"
          >
            <FileText size={13} className="text-indigo-400" />
            Print / PDF
          </button>

          {/* Share Link Copier */}
          <button
            onClick={handleCopyTrigger}
            className="w-full py-2 bg-indigo-950/40 hover:bg-indigo-900 border border-indigo-500/20 rounded-xl text-[11px] font-bold text-indigo-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Share2 size={13} />
            {justCopied ? 'Copied!' : 'Share URL'}
          </button>
        </div>
      </div>

      {/* Bulk Paste Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase text-white tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="text-indigo-400" size={16} />
                Bulk Import Rally Leads
              </h3>
              <button 
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-slate-400">
                Paste one rally lead per line. Supported formats:
              </p>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 font-mono text-[10px] text-slate-400 space-y-1">
                <div>John</div>
                <div>Sarah, Priority 1</div>
                <div>Mike, Priority 2, Alliance: Omega</div>
                <div>Emma, Priority 4</div>
              </div>
              <p className="text-[10px] text-indigo-400/80">
                * Priorities mapping: Priority 1 (Highest), 2 (High), 3 (Normal), 4 (Low), 5 (Lowest).
              </p>
            </div>

            <textarea
              rows={8}
              placeholder="Sarah, Priority 1&#10;John, Priority 2, Alliance Alpha&#10;Mike&#10;Alex, Priority 4"
              value={bulkTextInput}
              onChange={(e) => setBulkTextInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl p-3 text-xs text-white placeholder-slate-700 outline-none transition font-mono"
            />

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 border border-slate-800 text-slate-400 rounded-xl font-bold text-xs hover:bg-slate-850 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={!bulkTextInput.trim()}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-800 text-white rounded-xl font-bold text-xs transition"
              >
                Import Leads
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
