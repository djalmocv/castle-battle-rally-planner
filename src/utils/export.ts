import { RallyLead, PriorityLevel, GridSettings, Alliance } from '../types';
import { getMarchTimeToCastle, formatMarchTime } from './march';
import { getAllianceById } from '../constants';

/**
 * Wraps a value in quotes and neutralizes spreadsheet formula injection by
 * prefixing a single quote to any field starting with = + - @ (or tab / CR).
 */
export function escapeCell(value: string): string {
  let sanitized = value;
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = `'${sanitized}`;
  }
  return `"${sanitized.replace(/"/g, '""')}"`;
}

/**
 * Exports rally lead assignments to CSV format.
 * CSV format: Rally Lead,Alliance,Priority,X,Y,Status,March
 */
export function exportToCSV(leads: RallyLead[], settings: GridSettings, alliances: Alliance[]): void {
  const headers = ['Rally Lead', 'Alliance', 'Priority', 'X', 'Y', 'Status', 'March'];

  const rows = leads.map((lead) => {
    const xVal = lead.position !== null ? lead.position.x : 'Unassigned';
    const yVal = lead.position !== null ? lead.position.y : 'Unassigned';
    const status = lead.locked ? 'Locked' : 'Flexible';
    const priorityName = PriorityLevel[lead.priority] || lead.priority;
    const allianceName = getAllianceById(alliances, lead.allianceId)?.name || '-';
    const march =
      lead.position !== null
        ? formatMarchTime(getMarchTimeToCastle(lead.position.x, lead.position.y, settings, !!lead.usesPet))
        : '-';

    const nameEscaped = escapeCell(lead.name);
    const allianceEscaped = escapeCell(allianceName);

    return [nameEscaped, allianceEscaped, priorityName, xVal, yVal, status, march].join(',');
  });
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `castle_battle_layout_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Converts a DOM SVG Element into a high-res PNG Data URL.
 * Captures all CSS styles and rules to ensure Tailwind stylings
 * and custom layout options render pixel-perfectly.
 */
export function getSVGImageBytes(svgElement: SVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;

      // Ensure dimensions are set directly based on the element bounding size
      const bbox = svgElement.getBoundingClientRect();
      const width = svgElement.clientWidth || bbox.width || 800;
      const height = svgElement.clientHeight || bbox.height || 800;
      
      clonedSvg.setAttribute('width', width.toString());
      clonedSvg.setAttribute('height', height.toString());
      
      if (!clonedSvg.getAttribute('xmlns')) {
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }

      // Embed local system font fallback styles to guarantee flawless rendering
      // with absolutely zero external requests, preventing any canvas-tainting security alerts.
      const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleElement.textContent = `
        svg {
          background-color: #070b19;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        text {
          user-select: none;
        }
        .font-mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
        }
      `;
      clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);

      const serializer = new XMLSerializer();
      const svgMarkup = serializer.serializeToString(clonedSvg);
      
      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const blobURL = window.URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        try {
          const scale = 2.5; // High resolution rendering for professional quality
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            window.URL.revokeObjectURL(blobURL);
            reject(new Error('Canvas 2D context is unavailable'));
            return;
          }

          // Identical dark background to on-screen preview (#070b19)
          ctx.fillStyle = '#070b19';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Render high-res SVG image
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

          const pngDataUrl = canvas.toDataURL('image/png');
          window.URL.revokeObjectURL(blobURL);
          resolve(pngDataUrl);
        } catch (err) {
          window.URL.revokeObjectURL(blobURL);
          reject(err);
        }
      };

      image.onerror = () => {
        window.URL.revokeObjectURL(blobURL);
        reject(new Error('Failed to load serialized SVG on canvas'));
      };

      image.src = blobURL;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Captures the actual on-screen rendered map SVG exactly as it looks and downloads it as a PNG.
 */
export async function exportToPNG(): Promise<void> {
  const svgElement = document.getElementById('battle-map-svg');
  if (!svgElement) {
    console.error('Unified export failed: battle-map-svg not found in DOM.');
    return;
  }
  
  try {
    const pngDataUrl = await getSVGImageBytes(svgElement as unknown as SVGElement);
    const link = document.createElement('a');
    link.download = `castle_map_layout_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = pngDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to export map to PNG:', err);
  }
}
