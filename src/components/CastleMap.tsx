import React, { useState, useRef, useEffect, useMemo, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  HelpCircle, 
  RefreshCw,
  Move
} from 'lucide-react';
import { RallyLead, GridSettings, Location2D } from '../types';
import { 
  getDistanceToCastle, 
  checkOverlap, 
  checkOverlapWithCastle, 
  isValidState 
} from '../utils/assignment';
import { getPriorityStyle, getPetSlotLabel, getPetSlotShortLabel } from '../constants';
import { getMarchTimeToCastle, formatMarchTime } from '../utils/march';
import { CoordinateLabels, CastleStructure } from './MapLayers';

interface CastleMapProps {
  leads: RallyLead[];
  settings: GridSettings;
  onUpdateLeadPosition: (leadId: string, newPos: Location2D | null, swapLeadId?: string) => void;
  onToggleLeadLock: (leadId: string) => void;
}

export default function CastleMap({
  leads,
  settings,
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
  
  // Interactive Move State (Drag & Drop or Click-to-Move)
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragCurrentCell, setDragCurrentCell] = useState<Location2D | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null); // Click-to-move source
  const [hoveredLeadId, setHoveredLeadId] = useState<string | null>(null);
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);

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

  // Convert client pointer coordinate inside Map into Grid Index (integer coord)
  const getGridCoordFromPointer = (
    e: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>
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
      handleCityDrop();
    }
  };

  // Drag operations on City blocks
  const handleCityDragStart = (e: React.PointerEvent<SVGGElement>, leadId: string) => {
    e.stopPropagation();
    const lead = leads.find(l => l.id === leadId);
    if (!lead || !lead.position) return;

    setDragLeadId(leadId);
    setDragCurrentCell({ ...lead.position });
    setSelectedLeadId(null); // Clear selected
    
    if (svgRef.current) {
      svgRef.current.setPointerCapture(e.pointerId);
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

  // Click handle for "Click-to-Move"
  const handleCellClick = (e: MouseEvent<SVGSVGElement>) => {
    if (isPanning || dragLeadId) return;

    if (!selectedLeadId) {
      const target = e.target as SVGElement;
      const cityEl = target.closest('.city-element');
      if (cityEl) {
        const leadId = cityEl.getAttribute('data-lead-id');
        const lead = leads.find(l => l.id === leadId);
        if (lead && !lead.locked) {
          setSelectedLeadId(leadId);
        }
      }
      return;
    }

    // If we already have a selected lead, and we clicked somewhere else, let's treat it as a target coordinate to move
    const coord = getGridCoordFromPointer(e);
    if (!coord) {
      setSelectedLeadId(null);
      return;
    }

    const targetCell = { ...coord };

    // Stop if target is castle
    if (checkOverlapWithCastle(targetCell, settings)) {
      setSelectedLeadId(null);
      return;
    }

    // Check if target overlaps with another lead
    const otherLead = leads.find(
      (l) => l.id !== selectedLeadId && l.position && checkOverlap(targetCell, l.position)
    );

    if (otherLead) {
      if (!otherLead.locked) {
        // Swap them!
        onUpdateLeadPosition(selectedLeadId, otherLead.position, otherLead.id);
      }
    } else {
      // Place it if valid
      if (isValidState(targetCell, selectedLeadId, leads, settings)) {
        onUpdateLeadPosition(selectedLeadId, targetCell);
      }
    }

    setSelectedLeadId(null);
  };

  // Close selection on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedLeadId(null);
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
        {/* Coordinate Tooltip Overlay on Move instructions */}
        <AnimatePresence>
          {selectedLeadId && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-600/95 text-white text-xs px-4 py-2 rounded-xl shadow-xl border border-indigo-400/30 flex items-center gap-2 z-10 font-medium"
            >
              <Move className="animate-bounce" size={14} />
              <span>
                Click any valid empty space or another city to swap/reposition <b>{leads.find(l => l.id === selectedLeadId)?.name}</b>
              </span>
              <button 
                onClick={() => setSelectedLeadId(null)}
                className="ml-2 hover:bg-indigo-700 bg-indigo-900/30 text-indigo-200 px-1.5 py-0.5 rounded text-[10px]"
              >
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
            onClick={handleCellClick}
          >
            {/* Define grids / gradients */}
            <defs>
              {/* Core castle neon laser effect */}
              <radialGradient id="castleGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.0" />
              </radialGradient>
              
              {/* Highlight active selection glowing pulse pattern */}
              <filter id="cityGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

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

            {/* 4. Active Drag-snapped preview area */}
            {dragLeadId && dragCurrentCell && (() => {
              const isDropValid = isValidState(dragCurrentCell, dragLeadId, leads, settings);
              return (
              <g transform={`translate(${dragCurrentCell.x * cellSize}, ${dragCurrentCell.y * cellSize})`}>
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
                const isSelectedForMove = selectedLeadId === lead.id;
                const priorityStyles = getPriorityStyle(lead.priority);
                
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
                      if (!lead.locked) {
                        handleCityDragStart(e, lead.id);
                      }
                    }}
                    onMouseEnter={() => setHoveredLeadId(lead.id)}
                    onMouseLeave={() => setHoveredLeadId(null)}
                  >
                    {/* Glowing shadow effect if selected */}
                    {isSelectedForMove && (
                      <rect
                        x={-4}
                        y={-4}
                        width={size + 8}
                        height={size + 8}
                        rx={6}
                        fill="none"
                        stroke="#6366f1" // indigo 500
                        strokeWidth={3}
                        strokeDasharray="4,2"
                        className="animate-spin"
                        style={{ transformOrigin: 'center' }}
                      />
                    )}

                    {/* City Outer Block Body */}
                    <rect
                      x={2}
                      y={2}
                      width={size - 4}
                      height={size - 4}
                      rx={6}
                      fill={priorityStyles.fill}
                      fillOpacity={0.88}
                      stroke={isSelectedForMove ? '#6366f1' : priorityStyles.stroke}
                      strokeWidth={isSelectedForMove ? 3 : 2}
                      filter={isSelectedForMove ? 'url(#cityGlow)' : undefined}
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

                    {/* Lock Icon directly inside the city rectangle top-right */}
                    <g 
                      transform={`translate(${size - 22}, 6) rotate(${isRotated45 ? -45 : 0}, 8, 8)`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLeadLock(lead.id);
                      }}
                    >
                      <rect
                        width={16}
                        height={16}
                        rx={4}
                        fill="rgba(15, 23, 42, 0.75)"
                        className="hover:fill-slate-900 transition-colors"
                      />
                      {lead.locked ? (
                        <Lock size={9} fill="#ef4444" stroke="#ef4444" className="translate-x-[3.5px] translate-y-[3.5px]" />
                      ) : (
                        <Unlock size={9} stroke="#94a3b8" className="translate-x-[3.5px] translate-y-[3.5px]" />
                      )}
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

                      {/* Custom lead notes below name instead of coordinates */}
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
                        {lead.notes ? (lead.notes.length > 12 ? `${lead.notes.substring(0, 11)}..` : lead.notes) : '-'}
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
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-purple-500 border border-purple-400" />
              <span className="text-slate-300 font-medium">Highest Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-blue-500 border border-blue-400" />
              <span className="text-slate-300 font-medium">High</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 border border-emerald-400" />
              <span className="text-slate-300 font-medium">Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 border border-amber-400" />
              <span className="text-slate-300 font-medium">Low Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-slate-500 border border-slate-400" />
              <span className="text-slate-300 font-medium">Lowest Priority</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400/85 space-y-1 border-t border-slate-900 pt-1.5 mt-1 font-sans">
            <p>• <b>Drag & Drop</b> to move positions freely.</p>
            <p>• <b>Drop on another city</b> to swap them.</p>
            <p>• Click to select and click target to <b>Move</b>.</p>
            <p>• Click lock icon or list lock to <b>Lock</b> it.</p>
          </div>
        </div>

        {/* Hovered city full informational box (Bottom-Left overlay) */}
        {hoveredLeadId && (
          <div className="absolute bottom-4 right-4 bg-slate-900/95 border border-indigo-500/30 rounded-xl p-3 w-[220px] backdrop-blur z-20 shadow-2xl">
            {(() => {
              const lead = leads.find((l) => l.id === hoveredLeadId);
              if (!lead || !lead.position) return null;
              const priorityColor = getPriorityStyle(lead.priority);
              const dist = getDistanceToCastle(lead.position.x, lead.position.y, settings);
              const marchSeconds = getMarchTimeToCastle(lead.position.x, lead.position.y, settings, !!lead.usesPet);
              return (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="text-xs font-bold text-white tracking-wide truncate max-w-[120px]">
                      {lead.name}
                    </h3>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${priorityColor.badgeClass}`}>
                      {priorityColor.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                    <div>X, Y: <b className="text-slate-200">({lead.position.x}, {lead.position.y})</b></div>
                    <div>Distance: <b className="text-slate-200">{Math.round(dist)}</b></div>
                    <div>Locked: <b className={lead.locked ? 'text-red-400' : 'text-emerald-400'}>{lead.locked ? 'Yes' : 'No'}</b></div>
                    <div>March: <b className="text-indigo-300">{formatMarchTime(marchSeconds)}</b></div>
                  </div>

                  {lead.notes && (
                    <div className="text-[10px] text-indigo-200 bg-indigo-950/40 p-1.5 rounded border border-indigo-500/10 italic truncate">
                      "{lead.notes}"
                    </div>
                  )}

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
