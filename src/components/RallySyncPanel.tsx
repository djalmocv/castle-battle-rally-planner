import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Clock, Play, Square, Zap, AlertTriangle, X, Users, Flag, Volume2, VolumeX } from 'lucide-react';
import { GridSettings, RallyLead, RallySyncGroup } from '../types';
import { computeRallyPlan, formatLaunchOffset } from '../utils/rallySync';
import { formatMarchTime } from '../utils/march';
import { unlockAudio, playCountdownTick, playGoCue, playImpact } from '../utils/audio';

interface RallySyncPanelProps {
  groups: RallySyncGroup[];
  leads: RallyLead[];
  settings: GridSettings;
  onAddGroup: (name: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onRemoveGroup: (id: string) => void;
  onToggleMember: (id: string, leadId: string) => void;
  onToggleMemberPet: (id: string, leadId: string) => void;
  onSetAllPets: (id: string, active: boolean) => void;
  onStartSequence: (id: string) => void;
  onStopSequence: (id: string) => void;
}

/** Seconds of lead-in after GO before the first launcher's cue fires. */
const LEAD_IN_SECONDS = 3;

const SOUND_STORAGE_KEY = 'castle_battle_rally_sound';

const pad = (n: number) => n.toString().padStart(2, '0');

function formatClock(seconds: number): string {
  const sign = seconds < 0 ? '-' : '';
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${pad(s)}`;
}

export default function RallySyncPanel({
  groups,
  leads,
  settings,
  onAddGroup,
  onRenameGroup,
  onRemoveGroup,
  onToggleMember,
  onToggleMemberPet,
  onSetAllPets,
  onStartSequence,
  onStopSequence,
}: RallySyncPanelProps) {
  // Live clock tick (1s) drives every wave's launch/impact countdown.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SOUND_STORAGE_KEY, soundEnabled ? 'on' : 'off');
    }
  }, [soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) unlockAudio(); // enabling counts as a user gesture
      return next;
    });
  };

  const leadsById = useMemo(() => {
    const map = new Map<string, RallyLead>();
    for (const lead of leads) map.set(lead.id, lead);
    return map;
  }, [leads]);

  return (
    <div className="h-full flex flex-col bg-slate-950/40 border border-slate-850 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-850 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 rounded-lg shadow ring-1 ring-white/10">
            <Zap className="text-white" size={16} />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white tracking-wide">RALLY SYNC</h2>
            <p className="text-[10px] text-slate-400">Stagger launches so every rally lands together</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className={`rounded-xl p-2 transition cursor-pointer border ${
              soundEnabled
                ? 'bg-slate-800/70 border-slate-700 text-emerald-300 hover:bg-slate-800'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={soundEnabled ? 'Sound cues on — click to mute' : 'Sound cues muted — click to enable'}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button
            onClick={() => onAddGroup('')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3.5 py-2 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            New Wave
          </button>
        </div>
      </div>


      <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
        {groups.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 gap-3 py-16">
            <Users size={40} className="text-slate-700" />
            <p className="text-sm font-bold text-slate-400">No rally waves yet</p>
            <p className="text-xs max-w-xs">
              Create a wave, add the leads that should rally together, and set the impact time. Each lead gets a staggered
              launch cue so their marches all land on the exact same second.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <WaveCard
              key={group.id}
              group={group}
              leads={leads}
              leadsById={leadsById}
              settings={settings}
              now={now}
              soundEnabled={soundEnabled}
              onRename={onRenameGroup}
              onRemove={onRemoveGroup}
              onToggleMember={onToggleMember}
              onToggleMemberPet={onToggleMemberPet}
              onSetAllPets={onSetAllPets}
              onStartSequence={onStartSequence}
              onStopSequence={onStopSequence}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface WaveCardProps {
  group: RallySyncGroup;
  leads: RallyLead[];
  leadsById: Map<string, RallyLead>;
  settings: GridSettings;
  now: number;
  soundEnabled: boolean;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onToggleMember: (id: string, leadId: string) => void;
  onToggleMemberPet: (id: string, leadId: string) => void;
  onSetAllPets: (id: string, active: boolean) => void;
  onStartSequence: (id: string) => void;
  onStopSequence: (id: string) => void;
}

function WaveCard({
  group,
  leads,
  leadsById,
  settings,
  now,
  soundEnabled,
  onRename,
  onRemove,
  onToggleMember,
  onToggleMemberPet,
  onSetAllPets,
  onStartSequence,
  onStopSequence,
}: WaveCardProps) {
  const memberLeads = useMemo(
    () => group.leadIds.map((id) => leadsById.get(id)).filter((l): l is RallyLead => Boolean(l)),
    [group.leadIds, leadsById]
  );

  const petLeadIds = useMemo(() => new Set(group.petLeadIds ?? []), [group.petLeadIds]);

  const plan = useMemo(
    () => computeRallyPlan(memberLeads, settings, (lead) => petLeadIds.has(lead.id)),
    [memberLeads, settings, petLeadIds]
  );

  const availableLeads = leads.filter((l) => !group.leadIds.includes(l.id));
  const start = group.startEpochMs ?? null;
  const running = start !== null;

  // Time (s) from GO until impact = lead-in + longest march.
  const impactInSeconds = running ? Math.round((start + (LEAD_IN_SECONDS + plan.maxMarchSeconds) * 1000 - now) / 1000) : null;
  const leadInRemaining = running ? Math.ceil((start + LEAD_IN_SECONDS * 1000 - now) / 1000) : null;

  // Fire audio cues once each as the sequence hits its moments. Keyed events are
  // remembered so a cue never repeats on subsequent 1s ticks. The set resets
  // whenever a new sequence starts (start changes).
  const firedCuesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    firedCuesRef.current = new Set();
  }, [start]);

  useEffect(() => {
    if (!running || start === null || !soundEnabled) return;
    const fired = firedCuesRef.current;

    // Pre-launch countdown ticks (3… 2… 1…).
    if (leadInRemaining !== null && leadInRemaining > 0 && leadInRemaining <= LEAD_IN_SECONDS) {
      const key = `leadin:${leadInRemaining}`;
      if (!fired.has(key)) {
        fired.add(key);
        playCountdownTick();
      }
    }

    // Per-lead launch cues.
    for (const member of plan.members) {
      const launchEpoch = start + (LEAD_IN_SECONDS + member.launchOffsetSeconds) * 1000;
      const secsUntil = Math.round((launchEpoch - now) / 1000);
      if (secsUntil <= 0) {
        const key = `go:${member.lead.id}`;
        if (!fired.has(key)) {
          fired.add(key);
          playGoCue();
        }
      }
    }

    // Impact cue.
    if (impactInSeconds !== null && impactInSeconds <= 0 && !fired.has('impact')) {
      fired.add('impact');
      playImpact();
    }
  }, [now, running, start, soundEnabled, plan, leadInRemaining, impactInSeconds]);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header: name + delete */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-850 bg-slate-900/60">
        <Flag size={14} className="text-indigo-400 shrink-0" />
        <input
          value={group.name}
          onChange={(e) => onRename(group.id, e.target.value)}
          className="flex-1 bg-transparent text-sm font-extrabold text-white outline-none focus:bg-slate-950/60 rounded px-1.5 py-1 min-w-0"
          placeholder="Wave name"
        />
        <span className="text-[10px] font-mono text-slate-500 shrink-0">
          {plan.members.length} timed
          {plan.unassigned.length > 0 && ` · ${plan.unassigned.length} unplaced`}
        </span>
        <button
          onClick={() => onRemove(group.id)}
          className="text-slate-600 hover:text-red-400 p-1 transition shrink-0"
          title="Delete wave"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Member management */}
      <div className="px-4 py-3 border-b border-slate-850 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {memberLeads.length === 0 ? (
            <span className="text-[11px] text-slate-500">No leads added yet.</span>
          ) : (
            memberLeads.map((lead) => (
              <span
                key={lead.id}
                className="inline-flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 text-slate-200 text-[11px] font-semibold rounded-lg pl-2 pr-1 py-1"
              >
                {lead.name}
                <button
                  onClick={() => onToggleMember(group.id, lead.id)}
                  className="text-slate-500 hover:text-red-400 p-0.5"
                  title="Remove from wave"
                >
                  <X size={11} />
                </button>
              </span>
            ))
          )}
        </div>

        {availableLeads.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onToggleMember(group.id, e.target.value);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">+ Add a rally lead…</option>
            {availableLeads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
                {lead.position ? '' : ' (no position)'}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Launch control */}
      <div className="px-4 py-3 border-b border-slate-850 bg-slate-950/40">
        {!running ? (
          <button
            onClick={() => {
              unlockAudio();
              onStartSequence(group.id);
            }}
            disabled={plan.members.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-extrabold transition cursor-pointer"
          >
            <Play size={15} />
            GO — Start Launch Sequence
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onStopSequence(group.id)}
              className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl px-3 py-2.5 text-xs font-extrabold transition cursor-pointer shrink-0"
            >
              <Square size={13} />
              Stop
            </button>
            {leadInRemaining !== null && leadInRemaining > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black font-mono text-amber-300">{leadInRemaining}</span>
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wide">Get ready…</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Clock size={15} className={impactInSeconds !== null && impactInSeconds <= 0 ? 'text-red-400' : 'text-emerald-400'} />
                <span
                  className={`text-xl font-black font-mono ${
                    impactInSeconds !== null && impactInSeconds <= 0 ? 'text-red-400' : 'text-emerald-300'
                  }`}
                >
                  {impactInSeconds !== null && impactInSeconds > 0 ? formatClock(impactInSeconds) : 'IMPACT'}
                </span>
                <span className="text-[10px] text-slate-500">to impact</span>
              </div>
            )}
          </div>
        )}
        <p className="mt-2 text-[10px] text-slate-500">
          {LEAD_IN_SECONDS}s lead-in before the first lead launches, then each lead gets a live cue.
        </p>
      </div>

      {/* Launch sequence table */}
      <div className="px-2 py-2">
        {plan.members.length === 0 ? (
          <p className="text-[11px] text-slate-500 px-2 py-3 text-center">
            Add at least one placed lead to build the launch sequence.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                Launch sequence
              </span>
              <div className="flex items-center gap-1 text-[9px] font-bold">
                <span className="text-slate-500 uppercase tracking-wider mr-0.5">Pets</span>
                <button
                  onClick={() => onSetAllPets(group.id, true)}
                  className="rounded px-1.5 py-0.5 bg-purple-950/50 text-purple-300 border border-purple-500/30 hover:bg-purple-900/50 transition"
                  title="Mark every lead's pet active for this rally"
                >
                  All
                </button>
                <button
                  onClick={() => onSetAllPets(group.id, false)}
                  className="rounded px-1.5 py-0.5 bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:text-slate-200 transition"
                  title="No pets active for this rally"
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[24px_1fr_auto_auto] gap-2 px-2 py-1.5 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
              <span>#</span>
              <span>Lead</span>
              <span className="text-right">March</span>
              <span className="text-right">{running ? 'Launch' : 'Offset'}</span>
            </div>
            <div className="space-y-1">
              {plan.members.map((member, index) => {
                const isFirst = member.launchOffsetSeconds === 0;
                const isLast = index === plan.members.length - 1 && plan.members.length > 1;

                let launchLabel: string;
                let launchTone = 'text-slate-300';
                let rowHighlight = '';

                if (running && start !== null) {
                  // Launch moment = GO + lead-in + this lead's stagger offset.
                  const launchEpoch = start + (LEAD_IN_SECONDS + member.launchOffsetSeconds) * 1000;
                  const secsUntil = Math.round((launchEpoch - now) / 1000);
                  if (secsUntil > 0) {
                    launchLabel = `in ${formatClock(secsUntil)}`;
                    launchTone = 'text-slate-300';
                  } else if (secsUntil > -3) {
                    launchLabel = 'GO NOW';
                    launchTone = 'text-white';
                    rowHighlight = 'bg-emerald-600/20 ring-1 ring-emerald-500/50';
                  } else {
                    launchLabel = 'launched';
                    launchTone = 'text-slate-600';
                    rowHighlight = 'opacity-50';
                  }
                } else {
                  launchLabel = formatLaunchOffset(member.launchOffsetSeconds);
                }

                return (
                  <div
                    key={member.lead.id}
                    className={`grid grid-cols-[24px_1fr_auto_auto] gap-2 items-center px-2 py-1.5 rounded-lg text-xs ${rowHighlight || 'bg-slate-950/40'}`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-800 text-[10px] font-black text-slate-300">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-100 truncate flex items-center gap-1.5">
                        {member.lead.name}
                        <button
                          onClick={() => onToggleMemberPet(group.id, member.lead.id)}
                          className={`text-[8px] rounded px-1 font-bold border transition cursor-pointer ${
                            petLeadIds.has(member.lead.id)
                              ? 'bg-purple-950/60 text-purple-300 border-purple-500/40'
                              : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300'
                          }`}
                          title={
                            petLeadIds.has(member.lead.id)
                              ? 'Pet active for this rally (faster march). Click to disable.'
                              : 'No pet for this rally. Click if this lead\u2019s pet is active now.'
                          }
                        >
                          PET
                        </button>
                        {isFirst && (
                          <span className="text-[8px] bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 rounded px-1 font-bold uppercase">
                            First
                          </span>
                        )}
                        {isLast && (
                          <span className="text-[8px] bg-slate-800 text-slate-400 border border-slate-700 rounded px-1 font-bold uppercase">
                            Last
                          </span>
                        )}
                      </div>
                      {member.lead.position && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          ({member.lead.position.x}, {member.lead.position.y})
                        </div>
                      )}
                    </div>
                    <span className="text-right font-mono text-slate-400">{formatMarchTime(member.marchSeconds)}</span>
                    <span className={`text-right font-mono font-bold ${launchTone}`}>{launchLabel}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {plan.unassigned.length > 0 && (
          <div className="mt-2 mx-2 flex items-start gap-1.5 bg-amber-950/20 border border-amber-900/30 rounded-lg px-2.5 py-2">
            <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-300/90">
              {plan.unassigned.map((l) => l.name).join(', ')} {plan.unassigned.length === 1 ? 'has' : 'have'} no map
              position yet — assign on the map to include in the timing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
