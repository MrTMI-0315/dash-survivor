import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const sourcePath = process.argv[2];
const assetKind = process.argv[3] ?? "player";
const assetId = process.argv[4] ?? "player";
const runtimeBasePath = process.argv[5] ?? "assets/sprites/player/pirate";
const mappingPreset = process.argv[6] ?? "default";
const cleanupPreset = process.argv[7] ?? "default";
const assetKindFolder =
  assetKind === "enemy" ? "enemies" : assetKind === "boss" ? "boss" : assetKind === "projectile" ? "projectiles" : `${assetKind}s`;
const outputSlug = assetKind === "player" && assetId === "player" ? "player_sheet_8dir" : `${assetKindFolder}/${assetId}_sheet_8dir`;
const outRoot = path.join(root, "assets/generated/redesign_v2", outputSlug);
const artifactPrefix = `${assetId}_sheet`;
const title = assetId
  .split(/[-_]/g)
  .filter(Boolean)
  .map((part) => part[0].toUpperCase() + part.slice(1))
  .join(" ");
const sizes =
  assetKind === "boss"
    ? [48, 64, 96, 128, 160]
    : assetKind === "enemy"
      ? [24, 32, 48, 64, 96]
      : assetKind === "projectile"
        ? [16, 24, 32, 48, 64]
        : [32, 48, 64, 96];

const defaultDirections = [
  { name: "south", row: 0, col: 0, note: "front" },
  { name: "south-west", row: 0, col: 1, note: "front-left" },
  { name: "west", row: 0, col: 2, note: "left side" },
  { name: "north-west", row: 0, col: 3, note: "back-left" },
  { name: "north", row: 1, col: 0, note: "back" },
  { name: "north-east", row: 1, col: 1, note: "back-right" },
  { name: "east", row: 1, col: 2, note: "right side" },
  { name: "south-east", row: 1, col: 3, note: "front-right" }
];

const frontBackSplitDirections = [
  { name: "south", row: 0, col: 0, note: "front" },
  { name: "south-west", row: 0, col: 1, note: "front-left" },
  { name: "west", row: 0, col: 2, note: "left side" },
  { name: "south-east", row: 0, col: 3, note: "front-right" },
  { name: "north", row: 1, col: 0, note: "back" },
  { name: "north-west", row: 1, col: 1, note: "back-left" },
  { name: "east", row: 1, col: 2, note: "right side" },
  { name: "north-east", row: 1, col: 3, note: "back-right" }
];

const directions = mappingPreset === "front-back-split" ? frontBackSplitDirections : defaultDirections;

if (!sourcePath) {
  throw new Error("Usage: node scripts/split-player-sheet.mjs <source-sheet.png> [asset-kind] [asset-id] [runtime-base-path] [mapping-preset]");
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createImage(width, height, fill = [0, 0, 0, 0]) {
  const data = new Uint8ClampedArray(width * height * 4);
  const img = { width, height, data };
  if (fill[3] > 0) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
      data[i + 3] = fill[3];
    }
  }
  return img;
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, payload])));
  return Buffer.concat([len, typeBuf, payload, crc]);
}

function encodePng(img) {
  const raw = Buffer.alloc((img.width * 4 + 1) * img.height);
  for (let y = 0; y < img.height; y += 1) {
    const rowStart = y * (img.width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < img.width; x += 1) {
      const src = (y * img.width + x) * 4;
      const dst = rowStart + 1 + x * 4;
      raw[dst] = img.data[src];
      raw[dst + 1] = img.data[src + 1];
      raw[dst + 2] = img.data[src + 2];
      raw[dst + 3] = img.data[src + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function savePng(filePath, img) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, encodePng(img));
}

function readChunks(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error("Not a PNG file");
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readPng(filePath) {
  const chunks = readChunks(fs.readFileSync(filePath));
  const ihdr = chunks.find((entry) => entry.type === "IHDR")?.data;
  if (!ihdr) throw new Error("PNG missing IHDR");

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compression = ihdr[10];
  const filter = ihdr[11];
  const interlace = ihdr[12];
  if (bitDepth !== 8 || ![2, 6].includes(colorType) || compression !== 0 || filter !== 0 || interlace !== 0) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }

  const idat = Buffer.concat(chunks.filter((entry) => entry.type === "IDAT").map((entry) => entry.data));
  const inflated = zlib.inflateSync(idat);
  const channels = colorType === 6 ? 4 : 3;
  const bpp = channels;
  const rowBytes = width * channels;
  const rgba = createImage(width, height);
  let srcOffset = 0;
  let previous = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[srcOffset];
    srcOffset += 1;
    const row = Buffer.from(inflated.subarray(srcOffset, srcOffset + rowBytes));
    srcOffset += rowBytes;

    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= bpp ? row[x - bpp] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= bpp ? previous[x - bpp] : 0;
      if (filterType === 1) row[x] = (row[x] + left) & 255;
      else if (filterType === 2) row[x] = (row[x] + up) & 255;
      else if (filterType === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255;
      else if (filterType === 4) row[x] = (row[x] + paeth(left, up, upLeft)) & 255;
      else if (filterType !== 0) throw new Error(`Unsupported PNG filter ${filterType}`);
    }

    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      rgba.data[dst] = row[src];
      rgba.data[dst + 1] = row[src + 1];
      rgba.data[dst + 2] = row[src + 2];
      rgba.data[dst + 3] = channels === 4 ? row[src + 3] : 255;
    }
    previous = row;
  }
  return rgba;
}

function isCheckerPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min <= 7 && min >= 225;
}

function copyRegion(src, x0, y0, width, height) {
  const dst = createImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = x0 + x;
      const sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const srcIdx = (sy * src.width + sx) * 4;
      const dstIdx = (y * width + x) * 4;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = isCheckerPixel(src.data[srcIdx], src.data[srcIdx + 1], src.data[srcIdx + 2]) ? 0 : src.data[srcIdx + 3];
    }
  }
  return dst;
}

function bboxAlpha(img) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const a = img.data[(y * img.width + x) * 4 + 3];
      if (a === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function removeSmallComponents(img) {
  const visited = new Uint8Array(img.width * img.height);
  const minPixels = Math.max(64, Math.round(img.width * img.height * 0.01));
  const stack = [];
  const component = [];

  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const start = y * img.width + x;
      if (visited[start] || img.data[start * 4 + 3] === 0) continue;

      stack.length = 0;
      component.length = 0;
      stack.push(start);
      visited[start] = 1;

      while (stack.length > 0) {
        const current = stack.pop();
        component.push(current);
        const cx = current % img.width;
        const cy = Math.floor(current / img.width);
        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1]
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue;
          const next = ny * img.width + nx;
          if (visited[next] || img.data[next * 4 + 3] === 0) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }

      if (component.length < minPixels) {
        for (const index of component) img.data[index * 4 + 3] = 0;
      }
    }
  }
  return img;
}

function cropToBox(img, box, pad = 8) {
  const x0 = Math.max(0, box.minX - pad);
  const y0 = Math.max(0, box.minY - pad);
  const x1 = Math.min(img.width - 1, box.maxX + pad);
  const y1 = Math.min(img.height - 1, box.maxY + pad);
  return copyRegion(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

function resizeNearest(src, width, height) {
  const dst = createImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor((x / width) * src.width));
      const sy = Math.min(src.height - 1, Math.floor((y / height) * src.height));
      const srcIdx = (sy * src.width + sx) * 4;
      const dstIdx = (y * width + x) * 4;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }
  return dst;
}

function fitOnCanvas(src, size) {
  const margin = Math.max(2, Math.round(size * 0.08));
  const maxW = size - margin * 2;
  const maxH = size - margin * 2;
  const scale = Math.min(maxW / src.width, maxH / src.height);
  const drawW = Math.max(1, Math.round(src.width * scale));
  const drawH = Math.max(1, Math.round(src.height * scale));
  const resized = resizeNearest(src, drawW, drawH);
  const dst = createImage(size, size);
  const dx = Math.floor((size - drawW) / 2);
  const dy = Math.floor((size - drawH) / 2);
  blit(resized, dst, dx, dy);
  return dst;
}

function blit(src, dst, dx, dy) {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const srcIdx = (y * src.width + x) * 4;
      const a = src.data[srcIdx + 3];
      if (a === 0) continue;
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
      const dstIdx = (ty * dst.width + tx) * 4;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = a;
    }
  }
}

function fillChecker(img, cell = 8) {
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const light = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const c = light ? 232 : 210;
      const i = (y * img.width + x) * 4;
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
}

function writeContactSheet(images) {
  const tile = 104;
  const labelH = 16;
  const width = tile * 4;
  const height = (tile + labelH) * 2;
  const sheet = createImage(width, height);
  fillChecker(sheet, 8);
  images.forEach((entry, index) => {
    const x = (index % 4) * tile;
    const y = Math.floor(index / 4) * (tile + labelH);
    const framed = fitOnCanvas(entry.crop, 96);
    blit(framed, sheet, x + 4, y + 2);
  });
  savePng(path.join(outRoot, `contact_sheets/${artifactPrefix}_8dir_contact.png`), sheet);
}

function writeSizeCompare() {
  const ordered = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];
  const tile = Math.max(112, Math.max(...sizes) + 32);
  const sheet = createImage(tile * ordered.length, tile * sizes.length);
  fillChecker(sheet, 8);
  sizes.forEach((size, row) => {
    ordered.forEach((name, col) => {
      const img = readPng(path.join(outRoot, `runtime_${size}/rotations/${name}.png`));
      blit(img, sheet, col * tile + Math.floor((tile - size) / 2), row * tile + Math.floor((tile - size) / 2));
    });
  });
  savePng(path.join(outRoot, `contact_sheets/${artifactPrefix}_size_compare.png`), sheet);
}

function writeReview(metadata) {
  const runtimeLabel =
    assetKind === "enemy" ? `enemy \`${assetId}\`` : assetKind === "projectile" ? `projectile \`${assetId}\`` : `\`${assetId}\``;
  const recommendedSize =
    assetKind === "boss"
      ? "48px drop-in first, then 64px or 96px visual test"
      : assetKind === "projectile"
      ? "24px or 32px"
      : assetKind === "enemy" && assetId.includes("tank")
      ? "32px or 48px"
      : assetKind === "enemy"
        ? "24px or 32px"
        : "48px or 64px";
  const lines = [
    `# ${title} Sheet 8-Direction Review`,
    "",
    "## Verdict",
    `- Use this sheet as a primary v2 ${runtimeLabel} source. It is consistent enough for 8-direction runtime candidates.`,
    `- Runtime registration status: candidate only. Do not copy into \`${runtimeBasePath}/rotations/\` until one target size is approved in-game.`,
    "- Main caveat: the source has a baked checkerboard background, so alpha cleanup is heuristic.",
    `- Recommended first runtime test size: ${recommendedSize}.`,
    "",
    "## Direction Mapping",
    "",
    "| Sheet cell | Runtime filename | Reading | Crop size |",
    "| --- | --- | --- | --- |",
    ...metadata.map((entry) => `| row ${entry.row}, col ${entry.col} | \`${entry.name}.png\` | ${entry.note} | ${entry.cropWidth}x${entry.cropHeight} |`),
    "",
    "## Generated Sets",
    "- `source_crops/*.png`: tight transparent source crops.",
    ...sizes.map((size) => `- \`runtime_${size}/rotations/*.png\`: ${size}px runtime candidates.`),
    `- \`contact_sheets/${artifactPrefix}_8dir_contact.png\`: source-grid direction contact sheet.`,
    `- \`contact_sheets/${artifactPrefix}_size_compare.png\`: runtime-order size comparison; rows are ${sizes.join(", ")}.`,
    "",
    "## Runtime Notes",
    "- The project expects exact filenames: `south`, `south-east`, `east`, `north-east`, `north`, `north-west`, `west`, `south-west`.",
    `- Drop-in runtime target path after approval: \`${runtimeBasePath}/rotations/*.png\`.`,
    assetKind === "boss"
      ? "- Boss/miniboss scale, collision radius, and attack readability are controlled in `src/entities/BossEnemy.js`; larger source dimensions may need scale tuning after smoke testing."
      : assetKind === "projectile"
      ? "- Current boss bullets are generated in `src/scenes/GameScene.js` with the `boss_bullet` texture key. Runtime promotion needs loader/texture-key work before these directional sprites are used in-game."
      : assetKind === "enemy"
      ? "- Enemy archetype scale/radius is controlled in `src/config/enemies.js`, so large source dimensions may need scale tuning after smoke testing."
      : "- `src/entities/Player.js` currently uses `PLAYER_PIRATE_SCALE = 1.78`; larger source dimensions may need scale tuning after visual smoke testing.",
    "- `src/main.js` has pixel-art rendering enabled, so nearest-neighbor candidates are appropriate for the first pass."
  ];
  fs.writeFileSync(path.join(outRoot, `${assetId.toUpperCase()}_SHEET_REVIEW.md`), `${lines.join("\n")}\n`);
}

function writeManifest(metadata) {
  const manifest = {
    assetKind,
    assetId,
    runtimeBasePath,
    mappingPreset,
    cleanupPreset,
    source: path.relative(root, path.join(outRoot, `original/${artifactPrefix}.png`)),
    runtimeOrder: ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"],
    generatedSizes: sizes,
    directions: metadata.map(({ name, row, col, note, cropWidth, cropHeight }) => ({
      name,
      row,
      col,
      note,
      cropSize: [cropWidth, cropHeight],
      files: Object.fromEntries([
        ["crop", `source_crops/${name}.png`],
        ...sizes.map((size) => [`runtime${size}`, `runtime_${size}/rotations/${name}.png`])
      ])
    }))
  };
  fs.writeFileSync(path.join(outRoot, "mapping.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

fs.mkdirSync(outRoot, { recursive: true });
ensureDir(path.join(outRoot, `original/${artifactPrefix}.png`));
fs.copyFileSync(sourcePath, path.join(outRoot, `original/${artifactPrefix}.png`));

const source = readPng(sourcePath);
const extracted = [];

for (const direction of directions) {
  const x0 = Math.round((direction.col * source.width) / 4);
  const x1 = Math.round(((direction.col + 1) * source.width) / 4);
  const y0 = Math.round((direction.row * source.height) / 2);
  const y1 = Math.round(((direction.row + 1) * source.height) / 2);
  const cell = copyRegion(source, x0, y0, x1 - x0, y1 - y0);
  if (cleanupPreset === "large-components") removeSmallComponents(cell);
  const bbox = bboxAlpha(cell);
  if (!bbox) throw new Error(`No sprite pixels found for ${direction.name}`);
  const crop = cropToBox(cell, bbox, 8);
  savePng(path.join(outRoot, `source_crops/${direction.name}.png`), crop);
  for (const size of sizes) {
    savePng(path.join(outRoot, `runtime_${size}/rotations/${direction.name}.png`), fitOnCanvas(crop, size));
  }
  extracted.push({ ...direction, crop, cropWidth: crop.width, cropHeight: crop.height });
}

writeContactSheet(extracted);
writeSizeCompare();
writeReview(extracted);
writeManifest(extracted);

console.log(`Generated ${extracted.length} directions from ${source.width}x${source.height} sheet.`);
console.log(outRoot);
