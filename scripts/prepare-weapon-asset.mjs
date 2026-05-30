import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const sourcePath = process.argv[2];
const weaponId = process.argv[3] ?? "cutlass";
const outRoot = path.join(root, `assets/generated/redesign_v2/weapons/${weaponId}`);
const weaponMeta = {
  cutlass: {
    title: "Cutlass",
    runtimeWeapon: "dagger",
    runtimeIcon: "weapon_dagger_icon.png",
    projectile: "proj_dagger.png",
    verdict: "Good as a v2 dagger-family replacement. The silhouette reads clearly and matches the pirate player redesign.",
    fitNotes: [
      "32x32 is usable but very thin because the weapon is long and horizontal.",
      "48x48 or 64x64 preserves the guard, blade curve, and red cloth much better.",
      "The blade points east/north-east, which is useful as a base orientation for projectile rotation."
    ]
  },
  whip: {
    title: "Whip",
    runtimeWeapon: "lightning",
    runtimeIcon: "weapon_lightning_icon.png",
    projectile: "proj_whip.png",
    verdict: "Good as a v2 lightning/chain replacement. The looped cord communicates chaining better than a literal lightning bolt in the pirate theme.",
    fitNotes: [
      "32x32 reads as a whip loop, but the handle details compress heavily.",
      "48x48 is the strongest UI icon size for this asset.",
      "This should be icon-first; as a projectile it would need a separate swing/arc frame later."
    ]
  },
  boarding_axe: {
    title: "Boarding Axe",
    runtimeWeapon: "orbit_blades",
    runtimeIcon: "weapon_orbit_blades_icon.png",
    projectile: "proj_orbit_blade.png",
    verdict: "Good as a v2 orbit_blades replacement. A boarding axe reads as a heavier pirate blade and fits the evolved weapon slot.",
    fitNotes: [
      "32x32 remains readable because the axe head is broad.",
      "48x48 preserves the handle and metal highlight better.",
      "For orbit gameplay, a smaller separate projectile sprite may be needed so the icon does not feel too bulky."
    ]
  },
  flintlock: {
    title: "Flintlock",
    runtimeWeapon: "fireball",
    runtimeIcon: "weapon_fireball_icon.png",
    projectile: "proj_fireball.png",
    verdict: "Good as a v2 fireball replacement if the redesign moves from magic fireballs to pirate gunfire. The silhouette is crisp and strongly thematic.",
    fitNotes: [
      "32x32 is readable as a pistol, though the lock details become decorative noise.",
      "48x48 is the best inventory/icon candidate.",
      "This is not a good projectile sprite by itself; projectile replacement should be a bullet or muzzle flash."
    ]
  }
};
const meta = weaponMeta[weaponId] ?? {
  title: weaponId.replaceAll("_", " "),
  runtimeWeapon: weaponId,
  runtimeIcon: `weapon_${weaponId}_icon.png`,
  projectile: `proj_${weaponId}.png`,
  verdict: "Good as a v2 weapon candidate.",
  fitNotes: ["Check 32x32 readability before runtime registration."]
};

if (!sourcePath) {
  throw new Error("Usage: node scripts/prepare-weapon-asset.mjs <source.png> [weapon-id]");
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
  const interlace = ihdr[12];
  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }
  const idat = Buffer.concat(chunks.filter((entry) => entry.type === "IDAT").map((entry) => entry.data));
  const inflated = zlib.inflateSync(idat);
  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  const img = createImage(width, height);
  let offset = 0;
  let prev = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[offset];
    offset += 1;
    const row = Buffer.from(inflated.subarray(offset, offset + rowBytes));
    offset += rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = prev[x] ?? 0;
      const upLeft = x >= channels ? prev[x - channels] : 0;
      if (filterType === 1) row[x] = (row[x] + left) & 255;
      else if (filterType === 2) row[x] = (row[x] + up) & 255;
      else if (filterType === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255;
      else if (filterType === 4) row[x] = (row[x] + paeth(left, up, upLeft)) & 255;
      else if (filterType !== 0) throw new Error(`Unsupported PNG filter ${filterType}`);
    }
    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      img.data[dst] = row[src];
      img.data[dst + 1] = row[src + 1];
      img.data[dst + 2] = row[src + 2];
      img.data[dst + 3] = channels === 4 ? row[src + 3] : 255;
    }
    prev = row;
  }
  return img;
}

function isCheckerPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min <= 8 && min >= 225;
}

function removeChecker(img) {
  const out = createImage(img.width, img.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    out.data[i] = r;
    out.data[i + 1] = g;
    out.data[i + 2] = b;
    out.data[i + 3] = isCheckerPixel(r, g, b) ? 0 : img.data[i + 3];
  }
  return out;
}

function bboxAlpha(img) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function crop(img, box, pad = 14) {
  const x0 = Math.max(0, box.minX - pad);
  const y0 = Math.max(0, box.minY - pad);
  const x1 = Math.min(img.width - 1, box.maxX + pad);
  const y1 = Math.min(img.height - 1, box.maxY + pad);
  const out = createImage(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const src = ((y0 + y) * img.width + x0 + x) * 4;
      const dst = (y * out.width + x) * 4;
      out.data[dst] = img.data[src];
      out.data[dst + 1] = img.data[src + 1];
      out.data[dst + 2] = img.data[src + 2];
      out.data[dst + 3] = img.data[src + 3];
    }
  }
  return out;
}

function resizeNearest(src, width, height) {
  const out = createImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor((x / width) * src.width));
      const sy = Math.min(src.height - 1, Math.floor((y / height) * src.height));
      const s = (sy * src.width + sx) * 4;
      const d = (y * width + x) * 4;
      out.data[d] = src.data[s];
      out.data[d + 1] = src.data[s + 1];
      out.data[d + 2] = src.data[s + 2];
      out.data[d + 3] = src.data[s + 3];
    }
  }
  return out;
}

function blit(src, dst, dx, dy) {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const s = (y * src.width + x) * 4;
      if (src.data[s + 3] === 0) continue;
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
      const d = (ty * dst.width + tx) * 4;
      dst.data[d] = src.data[s];
      dst.data[d + 1] = src.data[s + 1];
      dst.data[d + 2] = src.data[s + 2];
      dst.data[d + 3] = src.data[s + 3];
    }
  }
}

function fitOnCanvas(src, width, height, marginRatio = 0.08) {
  const maxW = Math.max(1, Math.round(width * (1 - marginRatio * 2)));
  const maxH = Math.max(1, Math.round(height * (1 - marginRatio * 2)));
  const scale = Math.min(maxW / src.width, maxH / src.height);
  const drawW = Math.max(1, Math.round(src.width * scale));
  const drawH = Math.max(1, Math.round(src.height * scale));
  const out = createImage(width, height);
  blit(resizeNearest(src, drawW, drawH), out, Math.floor((width - drawW) / 2), Math.floor((height - drawH) / 2));
  return out;
}

function fillChecker(img, cell = 8) {
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const c = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? 232 : 210;
      const i = (y * img.width + x) * 4;
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
}

function writeContactSheet(files) {
  const tileW = 128;
  const tileH = 80;
  const sheet = createImage(tileW * files.length, tileH);
  fillChecker(sheet, 8);
  files.forEach((file, index) => {
    const img = readPng(file.path);
    blit(img, sheet, index * tileW + Math.floor((tileW - img.width) / 2), Math.floor((tileH - img.height) / 2));
  });
  savePng(path.join(outRoot, `contact_sheets/weapon_${weaponId}_candidates.png`), sheet);
}

fs.mkdirSync(outRoot, { recursive: true });
ensureDir(path.join(outRoot, `original/weapon_${weaponId}_source.png`));
fs.copyFileSync(sourcePath, path.join(outRoot, `original/weapon_${weaponId}_source.png`));

const source = readPng(sourcePath);
const transparent = removeChecker(source);
const box = bboxAlpha(transparent);
if (!box) throw new Error("No weapon pixels found");
const sourceCrop = crop(transparent, box, 14);

savePng(path.join(outRoot, `source_crops/weapon_${weaponId}_source_crop.png`), sourceCrop);

const outputs = [
  { label: "icon32", path: path.join(outRoot, `icons/weapon_${weaponId}_icon_32.png`), image: fitOnCanvas(sourceCrop, 32, 32, 0.04) },
  { label: "icon48", path: path.join(outRoot, `icons/weapon_${weaponId}_icon_48.png`), image: fitOnCanvas(sourceCrop, 48, 48, 0.04) },
  { label: "icon64", path: path.join(outRoot, `icons/weapon_${weaponId}_icon_64.png`), image: fitOnCanvas(sourceCrop, 64, 64, 0.04) },
  { label: "proj32", path: path.join(outRoot, `projectiles/proj_${weaponId}_32.png`), image: fitOnCanvas(sourceCrop, 32, 18, 0.02) },
  { label: "proj48", path: path.join(outRoot, `projectiles/proj_${weaponId}_48.png`), image: fitOnCanvas(sourceCrop, 48, 27, 0.02) },
  { label: "slash96", path: path.join(outRoot, `slash/slash_${weaponId}_96.png`), image: fitOnCanvas(sourceCrop, 96, 54, 0.02) },
  { label: "runtimeIcon", path: path.join(outRoot, `replacement_candidates/${meta.runtimeIcon}`), image: fitOnCanvas(sourceCrop, 32, 32, 0.04) }
];

for (const output of outputs) savePng(output.path, output.image);
writeContactSheet(outputs);

const review = [
  `# ${meta.title} Weapon Candidate Review`,
  "",
  "## Verdict",
  `- ${meta.verdict}`,
  `- Existing-weapon replacement target: \`${meta.runtimeWeapon}\` icon -> \`${meta.runtimeIcon}\`.`,
  "- Use as candidate only for now. Runtime weapon icons are currently 32x32, so direct registration should happen after comparing this candidate in-game.",
  "- The source background is baked checkerboard, so alpha cleanup is heuristic.",
  "",
  "## Suggested Names",
  `- Source: \`weapon_${weaponId}_source.png\``,
  `- Runtime icon replacement candidate: \`${meta.runtimeIcon}\``,
  `- Working icon candidate: \`weapon_${weaponId}_icon.png\``,
  `- Projectile/effect candidate: \`${meta.projectile}\``,
  "",
  "## Generated Candidates",
  `- \`icons/weapon_${weaponId}_icon_32.png\`: current runtime icon size.`,
  `- \`icons/weapon_${weaponId}_icon_48.png\`: better detail preview.`,
  `- \`icons/weapon_${weaponId}_icon_64.png\`: high-detail UI candidate.`,
  `- \`replacement_candidates/${meta.runtimeIcon}\`: drop-in filename candidate for the existing runtime icon.`,
  `- \`projectiles/proj_${weaponId}_32.png\` and \`projectiles/proj_${weaponId}_48.png\`: attack/projectile candidates.`,
  `- \`slash/slash_${weaponId}_96.png\`: larger slash/effect candidate.`,
  "",
  "## Fit Notes",
  ...meta.fitNotes.map((note) => `- ${note}`)
];

fs.writeFileSync(path.join(outRoot, `WEAPON_${weaponId.toUpperCase()}_REVIEW.md`), `${review.join("\n")}\n`);
fs.writeFileSync(
  path.join(outRoot, "mapping.json"),
  `${JSON.stringify(
    {
      id: weaponId,
      replacementTarget: meta.runtimeWeapon,
      runtimeIcon: meta.runtimeIcon,
      source: `original/weapon_${weaponId}_source.png`,
      sourceCrop: `source_crops/weapon_${weaponId}_source_crop.png`,
      candidates: outputs.map((output) => path.relative(outRoot, output.path))
    },
    null,
    2
  )}\n`
);

console.log(`Prepared ${weaponId} candidates from ${source.width}x${source.height} source.`);
console.log(outRoot);
