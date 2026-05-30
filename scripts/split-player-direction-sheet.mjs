import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const sourcePath = process.argv[2];
const outRoot = process.argv[3] ?? path.join(root, "assets/generated/redesign_v2/player_sheet_8dir");

if (!sourcePath) {
  console.error("Usage: node scripts/split-player-direction-sheet.mjs <sheet.png> [out-dir]");
  process.exit(1);
}

const mapping = [
  { row: 0, col: 0, direction: "south" },
  { row: 0, col: 1, direction: "south-west" },
  { row: 0, col: 2, direction: "west" },
  { row: 0, col: 3, direction: "north-west" },
  { row: 1, col: 0, direction: "north" },
  { row: 1, col: 1, direction: "north-east" },
  { row: 1, col: 2, direction: "east" },
  { row: 1, col: 3, direction: "south-east" }
];

const runtimeOrder = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  const sig = buf.subarray(0, 8);
  if (!sig.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("Not a PNG file");
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idats = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    pos += 4;
    const type = buf.subarray(pos, pos + 4).toString("ascii");
    pos += 4;
    const data = buf.subarray(pos, pos + len);
    pos += len + 4;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format bitDepth=${bitDepth} colorType=${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const bpp = channels;
  const stride = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idats));
  const rgba = new Uint8ClampedArray(width * height * 4);
  let inPos = 0;
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inPos++];
    inflated.copy(cur, 0, inPos, inPos + stride);
    inPos += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? cur[x - bpp] : 0;
      const up = prev[x];
      const upLeft = x >= bpp ? prev[x - bpp] : 0;
      let value = cur[x];
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + up) & 255;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (value + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      cur[x] = value;
    }
    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      rgba[dst] = cur[src];
      rgba[dst + 1] = cur[src + 1];
      rgba[dst + 2] = cur[src + 2];
      rgba[dst + 3] = colorType === 6 ? cur[src + 3] : 255;
    }
    cur.copy(prev);
  }
  return { width, height, data: rgba };
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

function rgba(color) {
  return [(color >>> 24) & 255, (color >>> 16) & 255, (color >>> 8) & 255, color & 255];
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
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function savePng(filePath, img) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, encodePng(img));
}

function createImage(width, height, color = 0x00000000) {
  const data = new Uint8ClampedArray(width * height * 4);
  const img = { width, height, data };
  if (color) rect(img, 0, 0, width, height, color);
  return img;
}

function setPixel(img, x, y, color) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const [r, g, b, a] = rgba(color);
  const i = (y * img.width + x) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}

function rect(img, x, y, w, h, color) {
  for (let yy = Math.max(0, y); yy < Math.min(img.height, y + h); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(img.width, x + w); xx += 1) {
      setPixel(img, xx, yy, color);
    }
  }
}

function getPixel(img, x, y) {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

function putPixel(img, x, y, px) {
  const i = (y * img.width + x) * 4;
  img.data[i] = px[0];
  img.data[i + 1] = px[1];
  img.data[i + 2] = px[2];
  img.data[i + 3] = px[3];
}

function isCheckerboardBackground(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 222 && max - min <= 10;
}

function isVisiblePixel(img, x, y) {
  const [r, g, b, a] = getPixel(img, x, y);
  return a > 0 && !isCheckerboardBackground(r, g, b);
}

function cropCell(sheet, row, col) {
  const x0 = Math.round((sheet.width * col) / 4);
  const x1 = Math.round((sheet.width * (col + 1)) / 4);
  const y0 = Math.round((sheet.height * row) / 2);
  const y1 = Math.round((sheet.height * (row + 1)) / 2);
  let minX = x1;
  let minY = y1;
  let maxX = x0;
  let maxY = y0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (isVisiblePixel(sheet, x, y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const pad = 10;
  minX = Math.max(x0, minX - pad);
  minY = Math.max(y0, minY - pad);
  maxX = Math.min(x1 - 1, maxX + pad);
  maxY = Math.min(y1 - 1, maxY + pad);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const out = createImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = getPixel(sheet, minX + x, minY + y);
      if (a === 0 || isCheckerboardBackground(r, g, b)) {
        putPixel(out, x, y, [0, 0, 0, 0]);
      } else {
        putPixel(out, x, y, [r, g, b, 255]);
      }
    }
  }
  return { img: out, bbox: { x: minX, y: minY, width, height } };
}

function resizeNearest(src, width, height) {
  const out = createImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor((x / width) * src.width));
      const sy = Math.min(src.height - 1, Math.floor((y / height) * src.height));
      putPixel(out, x, y, getPixel(src, sx, sy));
    }
  }
  return out;
}

function fitOnCanvas(src, canvasSize) {
  const maxContent = Math.floor(canvasSize * 0.86);
  const scale = Math.min(maxContent / src.width, maxContent / src.height);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const resized = resizeNearest(src, w, h);
  const out = createImage(canvasSize, canvasSize);
  const ox = Math.floor((canvasSize - w) / 2);
  const oy = canvasSize - h - Math.max(2, Math.round(canvasSize * 0.05));
  blit(resized, out, ox, oy, 1);
  return out;
}

function blit(src, dst, dx, dy, scale = 1) {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const px = getPixel(src, x, y);
      if (px[3] === 0) continue;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          putPixel(dst, dx + x * scale + sx, dy + y * scale + sy, px);
        }
      }
    }
  }
}

function drawDeckBackground(img) {
  rect(img, 0, 0, img.width, img.height, 0x7b5131ff);
  for (let y = 0; y < img.height; y += 16) rect(img, 0, y, img.width, 2, 0x4b2f1fff);
  for (let x = 0; x < img.width; x += 32) rect(img, x, 0, 2, img.height, 0x5f3926ff);
}

function makeContactSheet(items, filePath) {
  const cell = 128;
  const cols = 4;
  const rows = 2;
  const out = createImage(cols * cell, rows * cell);
  drawDeckBackground(out);
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cell;
    const y = row * cell;
    const preview = fitOnCanvas(item.img, 96);
    blit(preview, out, x + 16, y + 16, 1);
  }
  savePng(filePath, out);
}

function main() {
  const sheet = readPng(sourcePath);
  fs.mkdirSync(outRoot, { recursive: true });
  fs.mkdirSync(path.join(outRoot, "source"), { recursive: true });
  fs.copyFileSync(sourcePath, path.join(outRoot, "source", "player_8dir_sheet_source.png"));

  const manifest = {
    source: path.resolve(sourcePath),
    sourceSize: { width: sheet.width, height: sheet.height },
    mapping,
    notes: [
      "Checkerboard background was removed by high-brightness low-saturation thresholding.",
      "Generated files are candidates for review, not automatically promoted to runtime assets."
    ],
    outputs: {}
  };

  const extracted = [];
  for (const item of mapping) {
    const { img, bbox } = cropCell(sheet, item.row, item.col);
    extracted.push({ ...item, img, bbox });
    manifest.outputs[item.direction] = { bbox };
    savePng(path.join(outRoot, "cropped_source", `${item.direction}.png`), img);
    for (const size of [128, 96, 64, 48, 32]) {
      savePng(path.join(outRoot, `processed_${size}`, `${item.direction}.png`), fitOnCanvas(img, size));
    }
  }

  const runtimeItems = runtimeOrder.map((direction) => extracted.find((entry) => entry.direction === direction));
  makeContactSheet(runtimeItems, path.join(outRoot, "contact_sheets", "player_8dir_96_preview.png"));
  savePng(path.join(outRoot, "contact_sheets", "player_8dir_64_preview.png"), makeRuntimeStrip(runtimeItems, 64));
  savePng(path.join(outRoot, "contact_sheets", "player_8dir_48_preview.png"), makeRuntimeStrip(runtimeItems, 48));
  ensureDir(path.join(outRoot, "manifest.json"));
  fs.writeFileSync(path.join(outRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function makeRuntimeStrip(items, size) {
  const out = createImage(size * 8, size);
  drawDeckBackground(out);
  for (let i = 0; i < items.length; i += 1) {
    const sprite = fitOnCanvas(items[i].img, size);
    blit(sprite, out, i * size, 0, 1);
  }
  return out;
}

main();
