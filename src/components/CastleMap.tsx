import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { RallyLead, GridSettings, Location2D, Alliance } from '../types';
import {
  getDistanceToCastle,
  checkOverlap,
  isValidState
} from '../utils/assignment';
import { getPriorityStyle, getPetSlotLabel, getPetSlotShortLabel, getAllianceColor, getAllianceById, NEUTRAL_CITY_STYLE } from '../constants';
import { getMarchTimeToCastle, formatMarchTime } from '../utils/march';
import { CoordinateLabels, CastleStructure } from './MapLayers';

interface CastleMapProps {
  leads: RallyLead[];
  settings: GridSettings;
  alliances: Alliance[];
  onUpdateLeadPosition: (leadId: string, newPos: Location2D | null, swapLeadId?: string) => void;
  onToggleLeadLock: (leadId: string) => void;
}

export default function CastleMap({
  leads,
  settings,
  alliances,
  onUpdateLeadPosition,
  onToggleLeadLock,
}: CastleMapProps) {
  // SVG grid config
  const cellSize = 32; // width/height of one grid block in px
  const gridWidth = settings.width * cellSize;
  const gridHeight = settings.height * cellSize;

  // View state (Zoom & Pan)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<Location2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isRotated45, setIsRotated45] = useState<boolean>(true); // Rotated by default to match 45deg game perspective
  const panStart = useRef<Location2D>({ x: 0, y: 0 });

  // Interactive Move State (repositioning an already-placed city by dragging it)
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragCurrentCell, setDragCurrentCell] = useState<Location2D | null>(null);
  const [hoveredLeadId, setHoveredLeadId] = useState<string | null>(null);
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);

  // Which lead's city is currently pressed down. Used on release to toggle
  // lock for a *locked* city (its pointerdown never starts a drag, so there's
  // no dragCurrentCell to compare against — see handlePointerUp).
  const pressedLeadId = useRef<string | null>(null);

  // Live preview cell while an unplaced lead is being dragged in from the
  // roster list (native HTML5 drag-and-drop, separate from the in-map
  // pointer-drag above since the source is a different component).
  const [externalDragCoord, setExternalDragCoord] = useState<Location2D | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Auto-center map on load or orientation toggle
  useEffect(() => {
    if (mapContainerRef.current) {
      const parent = mapContainerRef.current;
      const sizeMultiplier = isRotated45 ? 1.414 : 1.0;
      const targetSize = gridWidth * sizeMultiplier;
      const targetZoom = Math.max(0.4, Math.min(1.0, parent.clientWidth / (targetSize + 80)));
      
      const px = parent.clientWidth / 2 - (gridWidth / 2) * targetZoom;
      const py = parent.clientHeight / 2 - (gridHeight / 2) * targetZoom;
      
      setPan({ x: px, y: py });
      setZoom(targetZoom);
    }
  }, [settings.width, settings.height, isRotated45]);

  // Handle Zoom buttons
  const handleZoomIn = () => setZoom((z) => Math.min(3.0, z + 0.15));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, z - 0.15));
  const handleZoomReset = () => {
    if (mapContainerRef.current) {
      const parent = mapContainerRef.current;
      const sizeMultiplier = isRotated45 ? 1.414 : 1.0;
      const targetSize = gridWidth * sizeMultiplier;
      const targetZoom = Math.max(0.4, Math.min(1.0, parent.clientWidth / (targetSize + 80)));
      
      setPan({
        x: parent.clientWidth / 2 - (gridWidth / 2) * targetZoom,
        y: parent.clientHeight / 2 - (gridHeight / 2) * targetZoom,
      });
      setZoom(targetZoom);
    }
  };

  // Convert client pointer coordinate inside Map into Grid Index (integer coord).
  // Accepts any event carrying clientX/clientY — mouse, pointer, or native drag events.
  const getGridCoordFromPointer = (
    e: { clientX: number; clientY: number }
  ): Location2D | null => {
    if (!svgRef.current) return null;
    
    // Get the rotated-board group element so we query CTM from its current perspective
    const boardGroup = svgRef.current.querySelector('#rotated-board') as SVGGraphicsElement | null;
    if (!boardGroup) return null;
    
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    
    // Use getScreenCTM() on the rotated board group to get the exact mapping 
    // including rotation, pan, zoom, parent offsets etc.
    const ctm = boardGroup.getScreenCTM();
    if (!ctm) return null;
    
    const localPt = pt.matrixTransform(ctm.inverse());
    
    let x = Math.floor(localPt.x / cellSize);
    let y = Math.floor(localPt.y / cellSize);
    
    // Apply snapping mode constraints if grid is alignment mode
    if (settings.snapMode === '2x2') {
      x = Math.floor(x / 2) * 2;
      y = Math.floor(y / 2) * 2;
    }

    return { x, y };
  };

  // Start panning if Shift holds, or pressing middle button
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // If clicking a city, we handle City Dragging instead of Panning
    const targetElement = e.target as SVGElement;
    if (targetElement.closest('.city-element')) {
      return;
    }

    setIsPanning(true);
    panStart.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    } else if (dragLeadId !== null) {
      const coord = getGridCoordFromPointer(e);
      if (coord) {
        // Bound checks to avoid dragging wild
        const boundX = Math.max(0, Math.min(settings.width - 2, coord.x));
        const boundY = Math.max(0, Math.min(settings.height - 2, coord.y));
        setDragCurrentCell({ x: boundX, y: boundY });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    } else if (dragLeadId !== null) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      // Determine click-vs-drag by whether the SNAPPED grid cell actually
      // changed — immune to pixel jitter, unlike comparing raw pointer
      // movement or relying on the native `click` event (pointer capture
      // taken for the drag can cause Chromium to retarget that click to the
      // capturing <svg> itself, silently breaking a click-based approach).
      const originalLead = leads.find((l) => l.id === dragLeadId);
      const releasedInPlace = !!(
        originalLead?.position &&
        dragCurrentCell &&
        originalLead.position.x === dragCurrentCell.x &&
        originalLead.position.y === dragCurrentCell.y
      );
      handleCityDrop();
      if (releasedInPlace) {
        onToggleLeadLock(dragLeadId);
      }
    } else if (pressedLeadId.current) {
      // A press on a *locked* city never starts a drag (see the per-city
      // onPointerDown below), so any release here is unambiguously a click.
      onToggleLeadLock(pressedLeadId.current);
    }
    pressedLeadId.current = null;
  };

  // Drag operations on City blocks
  const handleCityDragStart = (e: React.PointerEvent<SVGGElement>, leadId: string) => {
    e.stopPropagation();
    const lead = leads.find(l => l.id === leadId);
    if (!lead || !lead.position) return;

    setDragLeadId(leadId);
    setDragCurrentCell({ ...lead.position });

    if (svgRef.current) {
      // Can throw (e.g. no active pointer registered for this id) in some
      // browsers/synthetic-input scenarios. Failing to acquire capture is
      // non-fatal — the drag still works via pointermove on the svg regardless.
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleCityDrop = () => {
    if (!dragLeadId || !dragCurrentCell) {
      setDragLeadId(null);
      setDragCurrentCell(null);
      return;
    }

    const currentDragId = dragLeadId;
    const targetCell = { ...dragCurrentCell };
    setDragLeadId(null);
    setDragCurrentCell(null);

    // A plain click (pointerdown+pointerup with no movement) still starts and
    // ends a "drag" at the same cell. Bail out here so it doesn't push a
    // no-op position update onto the undo stack — the click's real job is
    // toggling lock (handled in handlePointerUp).
    const originalLead = leads.find((l) => l.id === currentDragId);
    if (originalLead?.position && originalLead.position.x === targetCell.x && originalLead.position.y === targetCell.y) {
      return;
    }

    // 1. Is there overlap with another city? Check if we drop exactly on another city to swap them!
    const overlappingLead = leads.find(
      (l) => l.id !== currentDragId && l.position && checkOverlap(targetCell, l.position)
    );

    if (overlappingLead) {
      // "Swap" logic:
      // Check if both lead and overlapping lead are not locked
      const leadObj = leads.find(l => l.id === currentDragId);
      if (leadObj?.locked || overlappingLead.locked) {
        // Can't move/swap locked cities
        return;
      }

      onUpdateLeadPosition(currentDragId, overlappingLead.position, overlappingLead.id);
    } else {
      // Normal placement
      const leadObj = leads.find(l => l.id === currentDragId);
      if (leadObj?.locked) return;

      if (isValidState(targetCell, currentDragId, leads, settings)) {
        onUpdateLeadPosition(currentDragId, targetCell);
      }
    }
  };

  // Native HTML5 drag-and-drop: receives an unplaced lead dragged in from the
  // roster list (a sibling component, so this is a separate mechanism from
  // the in-map pointer-drag used to reposition already-placed cities above).
  const handleExternalDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const coord = getGridCoordFromPointer(e);
    if (coord) {
      const boundX = Math.max(0, Math.min(settings.width - 2, coord.x));
      const boundY = Math.max(0, Math.min(settings.height - 2, coord.y));
      setExternalDragCoord({ x: boundX, y: boundY });
    }
  };

  const handleExternalDragLeave = (e: React.DragEvent<SVGSVGElement>) => {
    // Only clear when actually leaving the svg, not when moving between its children.
    if (e.currentTarget === e.target) {
      setExternalDragCoord(null);
    }
  };

  const handleExternalDrop = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    setExternalDragCoord(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) return;

    const coord = getGridCoordFromPointer(e);
    if (!coord) return;

    // A lead dragged in from the roster list never had a prior position, so
    // there's nothing to swap — only accept the drop onto an empty valid cell.
    if (isValidState(coord, leadId, leads, settings)) {
      onUpdateLeadPosition(leadId, coord);
    }
  };

  // Cancel an in-progress in-map drag on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragLeadId(null);
        setDragCurrentCell(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Memoized static grid cells (rebuilt only when board dimensions or castle change).
  // This is the heaviest render block (width x height rects) and is independent of
  // drag/hover/selection state, so caching it avoids re-creating ~1000 nodes each render.
  const gridCells = useMemo(() => (
    <g>
      {Array.from({ length: settings.width }).map((_, x) => (
        <g key={`col-${x}`}>
          {Array.from({ length: settings.height }).map((_, y) => {
            const isCastleArea =
              x >= settings.castleX &&
              x < settings.castleX + settings.castleSize &&
              y >= settings.castleY &&
              y < settings.castleY + settings.castleSize;

            // Light checkers/grid lines
            const strokeColor = '#1e293b'; // Slate 800
            const isEvenBlockSum = (x + y) % 2 === 0;
            const fill = isCastleArea
              ? 'none'
              : isEvenBlockSum
                ? '#0c152d'
                : '#090f23';

            return (
              <rect
                key={`cell-${x}-${y}`}
                x={x * cellSize}
                y={y * cellSize}
                width={cellSize}
                height={cellSize}
                fill={fill}
                stroke={strokeColor}
                strokeWidth={0.5}
              />
            );
          })}
        </g>
      ))}
    </g>
  ), [settings.width, settings.height, settings.castleX, settings.castleY, settings.castleSize]);

  return (
    <div className="flex flex-col h-full bg-[#0b1329] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Map Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3/5 bg-slate-900/90 border-b border-slate-800/80 z-20">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          <h2 className="text-sm font-semibold text-slate-200 tracking-wide">
            HYPERGRID INTERACTIVE MAP ({settings.width}x{settings.height})
          </h2>
        </div>

        {/* Action Widgets */}
        <div className="flex items-center gap-2">
          {/* Snap Status */}
          <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700/50">
            SNAP: {settings.snapMode === '2x2' ? '2x2 ROW-EVEN' : '1x1 ALL-CELL'}
          </span>

          {/* Unassigned Counter */}
          {leads.filter(l => !l.position).length > 0 && (
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20 animate-pulse">
              UNASSIGNED: {leads.filter(l => !l.position).length}
            </span>
          )}

          {/* Toggle Guides */}
          <button
            onClick={() => setShowCoordinates((prev) => !prev)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
              showCoordinates 
                ? 'bg-slate-800 text-slate-200 border-slate-700' 
                : 'bg-slate-950 text-slate-500 border-slate-900'
            }`}
            title="Toggle Coordinates"
          >
            {showCoordinates ? <Eye size={14} /> : <EyeOff size={14} />}
            <span className="hidden sm:inline font-medium">Guides</span>
          </button>

          {/* Map Grid Orientation Rotate Toggle */}
          <button
            onClick={() => setIsRotated45((prev) => !prev)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
              isRotated45 
                ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/40 hover:bg-indigo-600/40' 
                : 'bg-slate-950 text-slate-500 border-slate-900 hover:text-slate-400'
            }`}
            title="Toggle 45° Game Rotation"
          >
            <RefreshCw size={14} className={isRotated45 ? 'animate-spin-slow' : ''} />
            <span className="hidden sm:inline font-medium">
              {isRotated45 ? 'Rotated Diamond' : 'Flat Grid'}
            </span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800" />

          {/* Zoom Buttons */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1 px-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] font-mono text-slate-400 min-w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 px-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={handleZoomReset}
              className="p-1 px-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition border-l border-slate-900"
              title="Reset View"
            >
              <Maximize size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Map workspace (Pan and zoom stage) */}
      <div 
        ref={mapContainerRef}
        className="flex-1 w-full h-full overflow-hidden relative cursor-grab select-none select-none active:cursor-grabbing"
      >
        {/* SVG Board wrapper */}
        <div 
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: `${gridWidth}px`,
            height: `${gridHeight}px`,
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
          className="absolute"
        >
          <svg
            id="battle-map-svg"
            ref={svgRef}
            width={gridWidth}
            height={gridHeight}
            className="overflow-visible"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDragOver={handleExternalDragOver}
            onDragLeave={handleExternalDragLeave}
            onDrop={handleExternalDrop}
          >
            {/* Define grids / gradients */}
            <defs>
              {/* Core castle neon laser effect */}
              <radialGradient id="castleGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.0" />
              </radialGradient>
              
              {/* Bottom contrast gradient for city blocks */}
              <linearGradient id="cellBottomGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            <g id="rotated-board" transform={`rotate(${isRotated45 ? 45 : 0}, ${gridWidth / 2}, ${gridHeight / 2})`}>
            {/* 1. Underlying grid lines */}
            {gridCells}

            {/* 2. Boundary Coordinate Guides (X coordinates on top/bottom) */}
            <CoordinateLabels
              show={showCoordinates}
              width={settings.width}
              height={settings.height}
              cellSize={cellSize}
              gridWidth={gridWidth}
              gridHeight={gridHeight}
              isRotated45={isRotated45}
            />

            {/* 3. Central Castle (12x12 with neon red fortress walls) */}
            <CastleStructure
              castleX={settings.castleX}
              castleY={settings.castleY}
              castleSize={settings.castleSize}
              cellSize={cellSize}
              isRotated45={isRotated45}
            />

            {/* 4. Active Drag-snapped preview area (in-map reposition, or a lead dragged in from the roster list) */}
            {(dragCurrentCell || externalDragCoord) && (() => {
              const previewCell = dragCurrentCell ?? externalDragCoord!;
              const isDropValid = isValidState(previewCell, dragLeadId ?? '', leads, settings);
              return (
              <g transform={`translate(${previewCell.x * cellSize}, ${previewCell.y * cellSize})`}>
                {/* 2x2 preview block */}
                <rect
                  width={2 * cellSize}
                  height={2 * cellSize}
                  fill={
                    isDropValid
                      ? 'rgba(16, 185, 129, 0.2)' // Emerald semi-transparent
                      : 'rgba(239, 68, 68, 0.25)' // Red semi-transparent
                  }
                  stroke={
                    isDropValid
                      ? '#10b981'
                      : '#ef4444'
                  }
                  strokeWidth={2}
                  strokeDasharray="4,4"
                  className="pointer-events-none"
                />
                
                <text
                  x={cellSize}
                  y={cellSize}
                  transform={`rotate(${isRotated45 ? -45 : 0}, ${cellSize}, ${cellSize})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize="10px"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  className="pointer-events-none bg-black/50"
                >
                  {isDropValid ? 'SNAP HERE' : 'INVALID'}
                </text>
              </g>
              );
            })()}

            {/* 5. Placed cities */}
            <g>
              {leads.map((lead) => {
                if (!lead.position) return null;

                const isCurrentlyDragging = dragLeadId === lead.id;
                const priorityStyles = getPriorityStyle(lead.priority);
                const alliance = getAllianceById(alliances, lead.allianceId);
                const cityColor = lead.allianceId ? getAllianceColor(alliance?.colorId) : NEUTRAL_CITY_STYLE;

                const cityX = lead.position.x * cellSize;
                const cityY = lead.position.y * cellSize;
                const size = 2 * cellSize; // 2x2 grid

                return (
                  <g
                    key={lead.id}
                    className="city-element group cursor-grab active:cursor-grabbing"
                    data-lead-id={lead.id}
                    transform={`translate(${cityX}, ${cityY})`}
                    opacity={isCurrentlyDragging ? 0.35 : 1}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      pressedLeadId.current = lead.id;
                      if (!lead.locked) {
                        handleCityDragStart(e, lead.id);
                      }
                    }}
                    onMouseEnter={() => setHoveredLeadId(lead.id)}
                    onMouseLeave={() => setHoveredLeadId(null)}
                  >
                    {/* City Outer Block Body — colored by Alliance tag (neutral gray if untagged) */}
                    <rect
                      x={2}
                      y={2}
                      width={size - 4}
                      height={size - 4}
                      rx={6}
                      fill={cityColor.fill}
                      fillOpacity={0.88}
                      stroke={cityColor.stroke}
                      strokeWidth={2}
                      className="transition-colors duration-200"
                    />

                    {/* Dark gradient overlay inside block bottom for contrast */}
                    <rect
                      x={3}
                      y={cellSize - 2}
                      width={size - 6}
                      height={cellSize}
                      rx={3}
                      fill="url(#cellBottomGradient)"
                      className="pointer-events-none opacity-20"
                    />

                    {/* Lock status indicator, top-right. Click anywhere on the city to toggle it. */}
                    <g transform={`translate(${size - 22}, 6) rotate(${isRotated45 ? -45 : 0}, 8, 8)`}>
                      <rect
                        width={16}
                        height={16}
                        rx={4}
                        fill="rgba(15, 23, 42, 0.75)"
                      />
                      {lead.locked ? (
                        <Lock size={9} fill="#ef4444" stroke="#ef4444" className="translate-x-[3.5px] translate-y-[3.5px]" />
                      ) : (
                        <Unlock size={9} stroke="#94a3b8" className="translate-x-[3.5px] translate-y-[3.5px]" />
                      )}
                    </g>

                    {/* Priority rank badge, top-left (secondary now that Alliance owns the city color) */}
                    <g transform={`translate(6, 6) rotate(${isRotated45 ? -45 : 0}, 8, 8)`}>
                      <rect
                        width={16}
                        height={16}
                        rx={4}
                        fill={priorityStyles.fill}
                        fillOpacity={0.9}
                        stroke={priorityStyles.stroke}
                        strokeWidth={1}
                      />
                      <text
                        x={8}
                        y={8.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#ffffff"
                        fontSize="9px"
                        fontWeight="bold"
                        className="select-none"
                      >
                        {lead.priority}
                      </text>
                    </g>

                    {/* Text content wrapped safely */}
                    <g className="pointer-events-none" transform={`rotate(${isRotated45 ? -45 : 0}, ${size / 2}, ${size / 2})`}>
                      {/* Name centering */}
                      <text
                        x={size / 2}
                        y={lead.usesPet ? size / 2 - 10 : size / 2 - 5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#ffffff"
                        fontSize="11px"
                        fontWeight="bold"
                        letterSpacing="0.01em"
                        className="select-none"
                      >
                        {lead.name.length > 10 ? `${lead.name.substring(0, 9)}..` : lead.name}
                      </text>

                      {/* Alliance name below the lead's name */}
                      <text
                        x={size / 2}
                        y={lead.usesPet ? size / 2 + 2 : size / 2 + 7}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="rgba(224, 231, 255, 0.85)"
                        fontSize="8px"
                        fontWeight="medium"
                        letterSpacing="0.01em"
                        className="select-none"
                      >
                        {(() => {
                          const name = getAllianceById(alliances, lead.allianceId)?.name;
                          if (!name) return '-';
                          return name.length > 12 ? `${name.substring(0, 11)}..` : name;
                        })()}
                      </text>

                      {/* Pet time slot below note if enabled */}
                      {lead.usesPet && (
                        <text
                          x={size / 2}
                          y={size / 2 + 13}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#ffffff"
                          fontSize="7.5px"
                          fontWeight="black"
                          letterSpacing="0.01em"
                          className="select-none font-mono"
                        >
                          {getPetSlotShortLabel(lead.petSlotId)}
                        </text>
                      )}
                    </g>

                    {/* Hover highlights */}
                    <rect
                      x={2}
                      y={2}
                      width={size - 4}
                      height={size - 4}
                      rx={6}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150"
                    />
                  </g>
                );
              })}
            </g>
            </g>
          </svg>
        </div>

        {/* Floating Mini Map Legend Controls (Bottom-Right overlay) */}
        <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-slate-800/80 rounded-xl p-3 max-w-[240px] z-15 backdrop-blur shadow-2xl space-y-2 pointer-events-auto">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest pb-1.5 border-b border-slate-800">
            <HelpCircle size={12} className="text-slate-400" />
            <span>Map Legend & Help</span>
          </div>

          <div className="space-y-1 text-[11px]">
            {alliances.length === 0 ? (
              <p className="text-slate-500 italic">No alliances yet — add one in the roster panel to color-code cities.</p>
            ) : (
              alliances.map((alliance) => {
                const color = getAllianceColor(alliance.colorId);
                return (
                  <div key={alliance.id} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded border" style={{ backgroundColor: color.fill, borderColor: color.stroke }} />
                    <span className="text-slate-300 font-medium truncate">{alliance.name}</span>
                  </div>
                );
              })
            )}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded border" style={{ backgroundColor: NEUTRAL_CITY_STYLE.fill, borderColor: NEUTRAL_CITY_STYLE.stroke }} />
              <span className="text-slate-300 font-medium">No alliance tag</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400/85 space-y-1 border-t border-slate-900 pt-1.5 mt-1 font-sans">
            <p>• Small corner number is <b>Priority</b> (1 closest–5 farthest).</p>
            <p>• <b>Drag an unassigned lead</b> from the roster onto the grid to place it.</p>
            <p>• <b>Drag a placed city</b> to reposition; drop on another to swap.</p>
            <p>• <b>Click a city</b> to Lock/Unlock it.</p>
          </div>
        </div>

        {/* Hovered city full informational box (Bottom-Left overlay) */}
        {hoveredLeadId && (
          <div className="absolute bottom-4 right-4 bg-slate-900/95 border border-indigo-500/30 rounded-xl p-3 w-[220px] backdrop-blur z-20 shadow-2xl">
            {(() => {
              const lead = leads.find((l) => l.id === hoveredLeadId);
              if (!lead || !lead.position) return null;
              const alliance = getAllianceById(alliances, lead.allianceId);
              const allianceColor = lead.allianceId ? getAllianceColor(alliance?.colorId) : NEUTRAL_CITY_STYLE;
              const dist = getDistanceToCastle(lead.position.x, lead.position.y, settings);
              const marchSeconds = getMarchTimeToCastle(lead.position.x, lead.position.y, settings, !!lead.usesPet);
              return (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="text-xs font-bold text-white tracking-wide truncate max-w-[120px]">
                      {lead.name}
                    </h3>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase"
                      style={{ backgroundColor: `${allianceColor.fill}33`, borderColor: allianceColor.stroke, color: allianceColor.stroke }}
                    >
                      {alliance?.name || 'No Alliance'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                    <div>X, Y: <b className="text-slate-200">({lead.position.x}, {lead.position.y})</b></div>
                    <div>Priority: <b className="text-slate-200">L{lead.priority}</b></div>
                    <div>Distance: <b className="text-slate-200">{Math.round(dist)}</b></div>
                    <div>Locked: <b className={lead.locked ? 'text-red-400' : 'text-emerald-400'}>{lead.locked ? 'Yes' : 'No'}</b></div>
                    <div className="col-span-2">March: <b className="text-indigo-300">{formatMarchTime(marchSeconds)}</b></div>
                  </div>

                  {lead.usesPet && (
                    <div className="text-[9px] text-orange-400 bg-orange-950/20 p-1.5 rounded border border-orange-500/10 font-bold flex items-center gap-1">
                      <span>🐾 Pet Slot:</span>
                      <span className="font-mono">{getPetSlotLabel(lead.petSlotId)}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
