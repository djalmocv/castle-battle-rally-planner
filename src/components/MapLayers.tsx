import React from 'react';

interface CoordinateLabelsProps {
  show: boolean;
  width: number;
  height: number;
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  isRotated45: boolean;
}

/**
 * Boundary coordinate guides (X on top/bottom, Y on left/right).
 * Pure render, memoized so it only rebuilds when the board dimensions,
 * rotation, or visibility change — not on every drag/hover.
 */
export const CoordinateLabels = React.memo(function CoordinateLabels({
  show,
  width,
  height,
  cellSize,
  gridWidth,
  gridHeight,
  isRotated45,
}: CoordinateLabelsProps) {
  if (!show) return null;

  return (
    <g opacity={0.7} className="pointer-events-none">
      {Array.from({ length: width }).map((_, x) => (
        <g key={`lbl-x-${x}`}>
          {/* Top Guide */}
          <text
            x={x * cellSize + cellSize / 2}
            y={-10}
            transform={`rotate(${isRotated45 ? -45 : 0}, ${x * cellSize + cellSize / 2}, -10)`}
            textAnchor="middle"
            fill="#475569"
            fontSize="9px"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {x}
          </text>
          {/* Bottom Guide */}
          <text
            x={x * cellSize + cellSize / 2}
            y={gridHeight + 15}
            transform={`rotate(${isRotated45 ? -45 : 0}, ${x * cellSize + cellSize / 2}, ${gridHeight + 15})`}
            textAnchor="middle"
            fill="#475569"
            fontSize="9px"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {x}
          </text>
        </g>
      ))}

      {/* Y coordinates on left/right */}
      {Array.from({ length: height }).map((_, y) => (
        <g key={`lbl-y-${y}`}>
          {/* Left Guide */}
          <text
            x={-12}
            y={y * cellSize + cellSize / 2}
            transform={`rotate(${isRotated45 ? -45 : 0}, -12, ${y * cellSize + cellSize / 2})`}
            dominantBaseline="middle"
            textAnchor="end"
            fill="#475569"
            fontSize="9px"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {y}
          </text>
          {/* Right Guide */}
          <text
            x={gridWidth + 12}
            y={y * cellSize + cellSize / 2}
            transform={`rotate(${isRotated45 ? -45 : 0}, ${gridWidth + 12}, ${y * cellSize + cellSize / 2})`}
            dominantBaseline="middle"
            textAnchor="start"
            fill="#475569"
            fontSize="9px"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {y}
          </text>
        </g>
      ))}
    </g>
  );
});

interface CastleStructureProps {
  castleX: number;
  castleY: number;
  castleSize: number;
  cellSize: number;
  isRotated45: boolean;
}

/**
 * The central castle keep with fortress walls, badge, and four corner turrets.
 * Pure render, memoized so it only rebuilds when the castle geometry or rotation change.
 */
export const CastleStructure = React.memo(function CastleStructure({
  castleX,
  castleY,
  castleSize,
  cellSize,
  isRotated45,
}: CastleStructureProps) {
  const px = castleSize * cellSize;
  const center = px / 2;

  return (
    <g transform={`translate(${castleX * cellSize}, ${castleY * cellSize})`}>
      {/* Outer castle zone background */}
      <rect
        width={px}
        height={px}
        fill="url(#castleGlow)"
        className="pointer-events-none"
      />

      {/* Deep stone slate background for fortress area */}
      <rect
        x={2}
        y={2}
        width={px - 4}
        height={px - 4}
        fill="#0a0a0d"
        stroke="#ef4444"
        strokeWidth={3}
        strokeDasharray="6,4" // Fortification battlements look
        className="shadow-2xl"
      />

      <rect
        x={12}
        y={12}
        width={px - 24}
        height={px - 24}
        fill="#dc2626"
        fillOpacity={0.12}
        stroke="#dc2626"
        strokeWidth={1.5}
        className="pointer-events-none"
      />
      {/* Core Castle Keep text decoration */}
      <g transform={`rotate(${isRotated45 ? -45 : 0}, ${center}, ${center})`} className="pointer-events-none">
        {/* Simulated badge background */}
        <rect
          x={center - 62}
          y={center - 38}
          width={124}
          height={18}
          rx={4}
          fill="#450a0a"
          stroke="#ef4444"
          strokeWidth={0.8}
          opacity={0.9}
        />

        {/* Badge red dot */}
        <circle cx={center - 50} cy={center - 29} r={3} fill="#ef4444" />

        {/* Badge Text */}
        <text
          x={center + 6}
          y={center - 29}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fca5a5"
          fontSize="8px"
          fontWeight="bold"
          fontFamily="monospace"
          letterSpacing="0.04em"
        >
          CASTLE CORE AREA
        </text>

        {/* CASTLE giant name */}
        <text
          x={center}
          y={center + 5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize="24px"
          fontWeight="950"
          fontFamily="sans-serif"
          letterSpacing="0.12em"
          style={{ filter: 'drop-shadow(0px 2px 8px rgba(239, 68, 68, 0.7))' }}
        >
          CASTLE
        </text>

        {/* Restricted grid text */}
        <text
          x={center}
          y={center + 32}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#64748b"
          fontSize="8.5px"
          fontWeight="bold"
          fontFamily="monospace"
          letterSpacing="0.05em"
        >
          {castleSize}X{castleSize} RESTRICTED GRID ZONE
        </text>
      </g>

      {/* Four corner 2x2 turrets */}
      {[
        { name: 'Turret NW', lx: 0, ly: 0 },
        { name: 'Turret NE', lx: castleSize - 2, ly: 0 },
        { name: 'Turret SW', lx: 0, ly: castleSize - 2 },
        { name: 'Turret SE', lx: castleSize - 2, ly: castleSize - 2 },
      ].map((turret, idx) => {
        const tx = turret.lx * cellSize;
        const ty = turret.ly * cellSize;
        const tSize = 2 * cellSize;
        return (
          <g key={idx} transform={`translate(${tx}, ${ty})`}>
            {/* Dark stone base background for the turret */}
            <rect
              x={1}
              y={1}
              width={tSize - 2}
              height={tSize - 2}
              rx={3}
              fill="#090514"
              stroke="#dc2626"
              strokeWidth={1.5}
            />

            {/* Outer frame */}
            <rect
              x={3}
              y={3}
              width={tSize - 6}
              height={tSize - 6}
              rx={2}
              fill="#1e1b4b"
              stroke="#f97316"
              strokeWidth={1}
            />

            {/* Inner glowing defensive circle */}
            <circle
              cx={tSize / 2}
              cy={tSize / 2}
              r={cellSize - 5}
              fill="#020617"
              stroke="#ea580c"
              strokeWidth={1}
              strokeDasharray="3,1.5"
            />

            {/* Turret red core bead */}
            <rect
              x={tSize / 2 - 3}
              y={tSize / 2 - 3}
              width={6}
              height={6}
              rx={1}
              fill="#ef4444"
              className="animate-pulse"
            />

            {/* Text labels rotated so they are easily readable/horizontal */}
            <g transform={`rotate(${isRotated45 ? -45 : 0}, ${tSize / 2}, ${tSize / 2})`}>
              <text
                x={tSize / 2}
                y={tSize / 2 - 7}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffedd5"
                fontSize="7px"
                fontWeight="extrabold"
                fontFamily="monospace"
                className="select-none"
              >
                TURRET
              </text>
              <text
                x={tSize / 2}
                y={tSize / 2 + 8}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f97316"
                fontSize="7px"
                fontWeight="black"
                fontFamily="monospace"
                className="select-none"
              >
                {turret.name.split(' ')[1]}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
});
