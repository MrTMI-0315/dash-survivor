#!/usr/bin/env node

import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OUT_DIR = "assets/generated/redesign_v2/environment/ship";

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readPng(filePath) {
  const buffer = readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`Not a PNG: ${filePath}`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      const interlace = data[12];
      if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
        throw new Error(`Unsupported PNG format in ${filePath}`);
      }
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const unfiltered = Buffer.alloc(width * height * channels);

  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[inputOffset];
    inputOffset += 1;
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[inputOffset + x];
      const left = x >= bytesPerPixel ? unfiltered[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? unfiltered[rowOffset + x - stride] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? unfiltered[rowOffset + x - stride - bytesPerPixel] : 0;
      let decoded = value;
      if (filter === 1) decoded = (value + left) & 0xff;
      else if (filter === 2) decoded = (value + up) & 0xff;
      else if (filter === 3) decoded = (value + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) decoded = (value + paethPredictor(left, up, upLeft)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter} in ${filePath}`);
      unfiltered[rowOffset + x] = decoded;
    }
    inputOffset += stride;
  }

  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < unfiltered.length; i += channels, j += 4) {
    pixels[j] = unfiltered[i];
    pixels[j + 1] = unfiltered[i + 1];
    pixels[j + 2] = unfiltered[i + 2];
    pixels[j + 3] = channels === 4 ? unfiltered[i + 3] : 255;
  }

  return { width, height, pixels };
}

function writePng(filePath, image) {
  const scanline = image.width * 4;
  const raw = Buffer.alloc((scanline + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    const rowOffset = y * (scanline + 1);
    raw[rowOffset] = 0;
    Buffer.from(image.pixels.buffer, image.pixels.byteOffset + y * scanline, scanline).copy(raw, rowOffset + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]));
}

function makeImage(width, height, fill = [0, 0, 0, 0]) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = fill[0];
    pixels[i + 1] = fill[1];
    pixels[i + 2] = fill[2];
    pixels[i + 3] = fill[3];
  }
  return { width, height, pixels };
}

function copyRegion(image, x, y, width, height) {
  const out = makeImage(width, height);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const srcX = Math.min(image.width - 1, Math.max(0, x + col));
      const srcY = Math.min(image.height - 1, Math.max(0, y + row));
      const src = (srcY * image.width + srcX) * 4;
      const dst = (row * width + col) * 4;
      out.pixels[dst] = image.pixels[src];
      out.pixels[dst + 1] = image.pixels[src + 1];
      out.pixels[dst + 2] = image.pixels[src + 2];
      out.pixels[dst + 3] = image.pixels[src + 3];
    }
  }
  return out;
}

function removeCheckerboard(image) {
  const out = makeImage(image.width, image.height);
  out.pixels.set(image.pixels);
  for (let i = 0; i < out.pixels.length; i += 4) {
    const r = out.pixels[i];
    const g = out.pixels[i + 1];
    const b = out.pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const grayish = max - min <= 12;
    const brightChecker = grayish && min >= 224;
    if (brightChecker) {
      out.pixels[i + 3] = 0;
    }
  }
  return out;
}

function alphaBounds(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.pixels[(y * image.width + x) * 4 + 3];
      if (alpha > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

function cropAlpha(image, pad = 8) {
  const bounds = alphaBounds(image);
  if (!bounds) return image;
  const x = Math.max(0, bounds.minX - pad);
  const y = Math.max(0, bounds.minY - pad);
  const right = Math.min(image.width - 1, bounds.maxX + pad);
  const bottom = Math.min(image.height - 1, bounds.maxY + pad);
  return copyRegion(image, x, y, right - x + 1, bottom - y + 1);
}

function centerSquareCrop(image) {
  const size = Math.min(image.width, image.height);
  const x = Math.floor((image.width - size) / 2);
  const y = Math.floor((image.height - size) / 2);
  return copyRegion(image, x, y, size, size);
}

function resizeNearest(image, width, height) {
  const out = makeImage(width, height);
  for (let y = 0; y < height; y += 1) {
    const srcY = Math.min(image.height - 1, Math.floor((y / height) * image.height));
    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(image.width - 1, Math.floor((x / width) * image.width));
      const src = (srcY * image.width + srcX) * 4;
      const dst = (y * width + x) * 4;
      out.pixels[dst] = image.pixels[src];
      out.pixels[dst + 1] = image.pixels[src + 1];
      out.pixels[dst + 2] = image.pixels[src + 2];
      out.pixels[dst + 3] = image.pixels[src + 3];
    }
  }
  return out;
}

function blit(src, dst, x, y) {
  for (let row = 0; row < src.height; row += 1) {
    const dstY = y + row;
    if (dstY < 0 || dstY >= dst.height) continue;
    for (let col = 0; col < src.width; col += 1) {
      const dstX = x + col;
      if (dstX < 0 || dstX >= dst.width) continue;
      const srcIdx = (row * src.width + col) * 4;
      const dstIdx = (dstY * dst.width + dstX) * 4;
      const alpha = src.pixels[srcIdx + 3] / 255;
      const inv = 1 - alpha;
      dst.pixels[dstIdx] = Math.round(src.pixels[srcIdx] * alpha + dst.pixels[dstIdx] * inv);
      dst.pixels[dstIdx + 1] = Math.round(src.pixels[srcIdx + 1] * alpha + dst.pixels[dstIdx + 1] * inv);
      dst.pixels[dstIdx + 2] = Math.round(src.pixels[srcIdx + 2] * alpha + dst.pixels[dstIdx + 2] * inv);
      dst.pixels[dstIdx + 3] = Math.max(dst.pixels[dstIdx + 3], src.pixels[srcIdx + 3]);
    }
  }
}

function fitOnCanvas(image, width, height) {
  const scale = Math.min(width / image.width, height / image.height);
  const scaledWidth = Math.max(1, Math.round(image.width * scale));
  const scaledHeight = Math.max(1, Math.round(image.height * scale));
  const resized = resizeNearest(image, scaledWidth, scaledHeight);
  const out = makeImage(width, height);
  blit(resized, out, Math.floor((width - scaledWidth) / 2), Math.floor((height - scaledHeight) / 2));
  return out;
}

function checker(width, height) {
  const out = makeImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const light = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const value = light ? 236 : 214;
      const i = (y * width + x) * 4;
      out.pixels[i] = value;
      out.pixels[i + 1] = value;
      out.pixels[i + 2] = value;
      out.pixels[i + 3] = 255;
    }
  }
  return out;
}

function sizePairs(sizes) {
  return sizes.map((size) => Array.isArray(size) ? size : [size, size]);
}

function safeCopy(source, destination) {
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function processEntry(entry) {
  const source = readPng(entry.source);
  const region = entry.rect ? copyRegion(source, ...entry.rect) : source;
  const prepared = entry.kind === "tile"
    ? centerSquareCrop(region)
    : cropAlpha(removeCheckerboard(region), entry.pad ?? 10);

  const originalPath = path.join(OUT_DIR, "original", `${entry.id}.png`);
  const cropPath = path.join(OUT_DIR, "source_crops", `${entry.id}.png`);
  safeCopy(entry.source, originalPath);
  writePng(cropPath, prepared);

  const outputs = [];
  for (const [width, height] of sizePairs(entry.sizes)) {
    const candidate = entry.kind === "tile"
      ? resizeNearest(prepared, width, height)
      : fitOnCanvas(prepared, width, height);
    const outPath = path.join(OUT_DIR, "candidates", `${entry.id}_${width}x${height}.png`);
    writePng(outPath, candidate);
    outputs.push({ width, height, path: outPath });
  }

  if (entry.runtimeTarget) {
    const [runtimeWidth, runtimeHeight] = entry.runtimeSize;
    const replacement = entry.kind === "tile"
      ? resizeNearest(prepared, runtimeWidth, runtimeHeight)
      : fitOnCanvas(prepared, runtimeWidth, runtimeHeight);
    writePng(path.join(OUT_DIR, "replacement_candidates", path.basename(entry.runtimeTarget)), replacement);
  }

  return {
    id: entry.id,
    kind: entry.kind,
    source: entry.source,
    crop: cropPath,
    replacementTarget: entry.runtimeTarget ?? "",
    note: entry.note ?? "",
    outputs
  };
}

function makeContactSheet(results) {
  const cell = 152;
  const padding = 16;
  const columns = 5;
  const rows = Math.ceil(results.length / columns);
  const sheet = checker(columns * cell + padding, rows * cell + padding);
  results.forEach((result, index) => {
    const crop = readPng(result.crop);
    const preview = fitOnCanvas(crop, 112, 112);
    const x = padding + (index % columns) * cell + 20;
    const y = padding + Math.floor(index / columns) * cell + 20;
    blit(preview, sheet, x, y);
  });
  const contactPath = path.join(OUT_DIR, "contact_sheets", "environment_ship_candidates.png");
  writePng(contactPath, sheet);
  return contactPath;
}

function writeReview(results, contactPath, batchId) {
  const lines = [
    "# Environment Ship Asset Candidates",
    "",
    `Batch: ${batchId}`,
    "",
    `Contact sheet: \`${contactPath}\``,
    "",
    "| id | kind | replacement target | candidate sizes | note |",
    "| --- | --- | --- | --- | --- |"
  ];
  for (const result of results) {
    const sizes = result.outputs.map((output) => `${output.width}x${output.height}`).join(", ");
    lines.push(`| ${result.id} | ${result.kind} | ${result.replacementTarget || "-"} | ${sizes} | ${result.note || "-"} |`);
  }
  lines.push("");
  lines.push("Runtime files were not overwritten. Use `replacement_candidates/` for manual promotion.");
  writeFileSync(path.join(OUT_DIR, "ENVIRONMENT_SHIP_ASSET_REVIEW.md"), `${lines.join("\n")}\n`);
}

function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    throw new Error("Usage: node scripts/prepare-environment-assets.mjs <manifest.json>");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const results = manifest.entries.map(processEntry);
  const contactPath = makeContactSheet(results);
  writeReview(results, contactPath, manifest.batchId ?? "environment_ship");
  writeFileSync(path.join(OUT_DIR, "mapping.json"), JSON.stringify({ ...manifest, results, contactPath }, null, 2));
  console.log(`Prepared ${results.length} environment asset candidates`);
  console.log(contactPath);
}

main();
