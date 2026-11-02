import { html, raw } from "hono/html";
import type { Html } from "./core.ts";

const BRASS = "#b58840";

/**
 * Automat's mark: a 3×3 wall of automat compartments, the centre one lit.
 * Line work uses `currentColor`; knobs and the lit window are brass.
 */
export function markSvg(options: { size?: number; className?: string } = {}) {
  const size = options.size ?? 32;
  const doors: string[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 4 + col * 14;
      const y = 4 + row * 14;
      const lit = row === 1 && col === 1;
      doors.push(
        `<rect x="${x}" y="${y}" width="12" height="12" rx="1.5"/>` +
          `<rect x="${x + 2}" y="${y + 2}" width="8" height="5" rx="0.5"${
            lit ? ` class="automat-mark__lit" fill="${BRASS}"` : ""
          }/>` +
          `<circle cx="${x + 9.5}" cy="${y + 9.5}" r="1.25" fill="${BRASS}" stroke="none"/>`,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}"${
    options.className ? ` class="${options.className}"` : ""
  } aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="1" y="1" width="46" height="46" rx="3"/>${doors.join("")}</svg>`;
}

/**
 * The mark, in a wrapper that carries the "a run is in progress" state. The
 * run status fragment swaps this out-of-band to start and stop the pulse.
 */
export function mark(running: boolean, oob = false): Html {
  return html`<span
    id="automat-mark"
    class="automat-mark${running ? " automat-running" : ""}"
    ${oob ? html`hx-swap-oob="true"` : ""}
    >${raw(markSvg({ className: "automat-mark__svg" }))}</span
  >`;
}

/**
 * The mark on white: aubergine line work, for empty states and error pages.
 */
export function markOnWhite(size = 64): Html {
  return html`<span class="automat-mark automat-mark--on-white"
    >${raw(markSvg({ size }))}</span
  >`;
}
