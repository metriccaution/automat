/**
 * Draw Automat's favicon and app icons. The outputs are committed, so this
 * only needs running when the artwork changes:
 *
 *   node scripts/build-icons.ts
 *
 * The favicon is a 2×2 wall of automat doors, top-right one lit, in white on
 * an aubergine rounded square. Raster versions are drawn from the same
 * shapes, so they always match the SVG.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { markSvg } from "../lib/web/views/components/logo.ts";

const AUBERGINE = "#4c2c92";
const BRASS = "#b58840";
const WHITE = "#ffffff";

const out = join(import.meta.dirname, "..", "public", "assets");

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

interface RoundRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

/**
 * Shapes on a 32×32 canvas, painted in order.
 */
interface Shape {
  rect: RoundRect;
  fill?: string;
  stroke?: { colour: string; width: number };
}

const SIZE = 32;
const STROKE = 2;

function favicon(): Shape[] {
  const shapes: Shape[] = [
    { rect: { x: 0, y: 0, w: 32, h: 32, r: 6 }, fill: AUBERGINE },
  ];
  for (const [col, row] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const) {
    const x = 5 + col * 13;
    const y = 5 + row * 13;
    const lit = col === 1 && row === 0;
    shapes.push({
      rect: { x, y, w: 9, h: 9, r: 1.5 },
      stroke: { colour: WHITE, width: STROKE },
    });
    shapes.push({
      rect: { x: x + 2.25, y: y + 2.25, w: 4.5, h: 3, r: 0.5 },
      fill: lit ? BRASS : undefined,
      stroke: { colour: WHITE, width: 1.25 },
    });
  }
  return shapes;
}

function faviconSvg(shapes: Shape[]): string {
  const body = shapes
    .map(({ rect: { x, y, w, h, r }, fill, stroke }) => {
      const attrs = [
        `x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"`,
        `fill="${fill ?? "none"}"`,
        stroke
          ? `stroke="${stroke.colour}" stroke-width="${stroke.width}"`
          : "",
      ];
      return `<rect ${attrs.filter(Boolean).join(" ")}/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>\n`;
}

/**
 * Signed distance from a point to a rounded rectangle (negative inside).
 */
function distance(px: number, py: number, { x, y, w, h, r }: RoundRect) {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    r
  );
}

/**
 * Rasterise with 4×4 supersampling, as RGBA.
 */
function rasterise(shapes: Shape[], size: number): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 4;
  const scale = SIZE / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) * scale;
          const y = (py + (sy + 0.5) / samples) * scale;
          let colour: Rgb | null = null;
          for (const shape of shapes) {
            const d = distance(x, y, shape.rect);
            if (shape.fill && d <= 0) colour = rgb(shape.fill);
            if (shape.stroke && Math.abs(d) <= shape.stroke.width / 2) {
              colour = rgb(shape.stroke.colour);
            }
          }
          if (colour) {
            r += colour[0];
            g += colour[1];
            b += colour[2];
            a += 1;
          }
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        pixels[i] = Math.round(r / a);
        pixels[i + 1] = Math.round(g / a);
        pixels[i + 2] = Math.round(b / a);
        pixels[i + 3] = Math.round((a / (samples * samples)) * 255);
      }
    }
  }
  return pixels;
}

function png(pixels: Buffer, size: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA

  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // no filter
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * An ICO file of PNG images.
 */
function ico(images: Array<{ size: number; data: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const shapes = favicon();
const pngOf = (size: number) => png(rasterise(shapes, size), size);

writeFileSync(join(out, "favicon.svg"), faviconSvg(shapes));
writeFileSync(
  join(out, "favicon.ico"),
  ico([16, 32, 48].map((size) => ({ size, data: pngOf(size) }))),
);
writeFileSync(join(out, "apple-touch-icon.png"), pngOf(180));
writeFileSync(join(out, "icon-192.png"), pngOf(192));
writeFileSync(join(out, "icon-512.png"), pngOf(512));

// The full mark, on white
writeFileSync(
  join(out, "logo.svg"),
  markSvg({ size: 96 })
    .replace('stroke="currentColor"', `stroke="${AUBERGINE}"`)
    .replace(' aria-hidden="true" focusable="false"', "") + "\n",
);

console.log(`Icons written to ${out}`);
