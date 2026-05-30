import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const outRoot = path.join(root, "assets/generated/redesign");
const runtimeRoot = path.join(root, "assets");
const directions = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];
const dirVector = {
  south: [0, 1],
  "south-east": [0.7, 0.7],
  east: [1, 0],
  "north-east": [0.7, -0.7],
  north: [0, -1],
  "north-west": [-0.7, -0.7],
  west: [-1, 0],
  "south-west": [-0.7, 0.7]
};

const colors = {
  outline: 0x071120ff,
  deepOutline: 0x03070dff,
  playerNavy: 0x172a43ff,
  playerNavyLight: 0x264461ff,
  leather: 0x765033ff,
  brass: 0xd3a34eff,
  red: 0xc92d37ff,
  redLight: 0xf05a5fff,
  skin: 0xc4875eff,
  steel: 0xd8e4eaff,
  steelDark: 0x627587ff,
  chaserDark: 0x0b3a43ff,
  chaser: 0x1cc5cfff,
  chaserLight: 0x92fff4ff,
  swarmDark: 0x0c3040ff,
  swarm: 0x36d3e0ff,
  tankDark: 0x151f2cff,
  tank: 0x526071ff,
  tankLight: 0x9aa6adff,
  warning: 0xf19a48ff,
  bossRobe: 0x1a1835ff,
  bossRobeLight: 0x343061ff,
  curse: 0x61f57cff,
  bone: 0xd2c6a4ff,
  deckDark: 0x4b2f1fff,
  deck: 0x7b5131ff,
  deckLight: 0xb47a48ff,
  tealShadow: 0x0d3d4dff,
  transparent: 0x00000000
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createImage(width, height, fill = colors.transparent) {
  const data = new Uint8ClampedArray(width * height * 4);
  const img = { width, height, data };
  if (fill !== colors.transparent) {
    rect(img, 0, 0, width, height, fill);
  }
  return img;
}

function rgba(color) {
  return [(color >>> 24) & 255, (color >>> 16) & 255, (color >>> 8) & 255, color & 255];
}

function setPixel(img, x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const [r, g, b, a] = rgba(color);
  const i = (y * img.width + x) * 4;
  if (a === 255) {
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = a;
    return;
  }
  const dstA = img.data[i + 3] / 255;
  const srcA = a / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  img.data[i] = Math.round((r * srcA + img.data[i] * dstA * (1 - srcA)) / outA);
  img.data[i + 1] = Math.round((g * srcA + img.data[i + 1] * dstA * (1 - srcA)) / outA);
  img.data[i + 2] = Math.round((b * srcA + img.data[i + 2] * dstA * (1 - srcA)) / outA);
  img.data[i + 3] = Math.round(outA * 255);
}

function rect(img, x, y, w, h, color) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy += 1) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx += 1) {
      setPixel(img, xx, yy, color);
    }
  }
}

function line(img, x0, y0, x1, y1, color, thickness = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    rect(img, x0 - Math.floor(thickness / 2), y0 - Math.floor(thickness / 2), thickness, thickness, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function ellipse(img, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(img, x, y, color);
    }
  }
}

function ellipseOutline(img, cx, cy, rx, ry, color, thickness = 1) {
  ellipse(img, cx, cy, rx, ry, color);
  ellipse(img, cx, cy, Math.max(1, rx - thickness), Math.max(1, ry - thickness), colors.transparent);
}

function poly(img, points, color) {
  const ys = points.map((p) => p[1]);
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));
  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const t = (y - y1) / (y2 - y1);
        intersections.push(x1 + t * (x2 - x1));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      const start = Math.ceil(intersections[i]);
      const end = Math.floor(intersections[i + 1]);
      for (let x = start; x <= end; x += 1) setPixel(img, x, y, color);
    }
  }
}

function copyImage(src, dst, dx, dy, scale = 1) {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const i = (y * src.width + x) * 4;
      const color = (src.data[i] << 24) | (src.data[i + 1] << 16) | (src.data[i + 2] << 8) | src.data[i + 3];
      if ((color & 255) === 0) continue;
      rect(dst, dx + x * scale, dy + y * scale, scale, scale, color >>> 0);
    }
  }
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

function drawPlayer(direction = "south") {
  const img = createImage(32, 32);
  const [dx, dy] = dirVector[direction];
  const cx = 16;
  const cy = 17;
  ellipse(img, cx, cy + 8, 7, 2, 0x00000055);
  ellipse(img, cx, cy + 4, 6, 8, colors.outline);
  ellipse(img, cx, cy + 4, 4, 6, colors.playerNavy);
  rect(img, cx - 5, cy + 1, 10, 3, colors.red);
  rect(img, cx - 3, cy + 3, 6, 2, colors.brass);
  line(img, cx - 4, cy + 9, cx - 6, cy + 13, colors.outline, 2);
  line(img, cx + 4, cy + 9, cx + 6, cy + 13, colors.outline, 2);
  line(img, cx - 4, cy + 9, cx - 6, cy + 12, colors.leather, 1);
  line(img, cx + 4, cy + 9, cx + 6, cy + 12, colors.leather, 1);
  ellipse(img, cx, cy - 5, 5, 5, colors.outline);
  ellipse(img, cx, cy - 5, 3, 3, colors.skin);
  rect(img, cx - 5, cy - 8, 10, 3, colors.red);
  setPixel(img, cx + (dx >= 0 ? 4 : -5), cy - 7, colors.redLight);
  if (dy >= 0) {
    setPixel(img, cx - 1, cy - 5, colors.deepOutline);
    setPixel(img, cx + 2, cy - 5, colors.deepOutline);
  }
  const handX = cx + (dx >= 0 ? 6 : -6);
  const handY = cy + 2;
  const swordX = handX + (dx || (direction.includes("east") ? 1 : -1)) * 7;
  const swordY = handY + (dy * 4);
  line(img, handX, handY, swordX, swordY, colors.outline, 2);
  line(img, handX, handY, swordX, swordY, colors.steel, 1);
  setPixel(img, swordX, swordY, colors.steel);
  const armX = cx - (dx >= 0 ? 5 : -5);
  line(img, armX, cy + 1, armX - dx * 2, cy + 4 + dy, colors.outline, 2);
  line(img, armX, cy + 1, armX - dx * 2, cy + 4 + dy, colors.playerNavyLight, 1);
  return img;
}

function drawDashSmear() {
  const img = createImage(32, 32);
  for (let i = 0; i < 5; i += 1) {
    const alpha = 0x32 - i * 6;
    ellipse(img, 20 - i * 3, 16, 8 - i, 4, (0x78d7ffff & 0xffffff00) | alpha);
  }
  line(img, 9, 16, 24, 16, 0xc8f3ff66, 2);
  return img;
}

function drawChaser(direction = "south") {
  const img = createImage(32, 32);
  const [dx, dy] = dirVector[direction];
  const cx = 16;
  const cy = 17;
  ellipse(img, cx, cy + 7, 7, 2, 0x00000044);
  ellipse(img, cx, cy, 8, 7, colors.outline);
  ellipse(img, cx, cy, 6, 5, colors.chaserDark);
  ellipse(img, cx, cy - 1, 4, 3, colors.chaser);
  line(img, cx - 7, cy, cx - 12 - dx * 2, cy + 4 + dy * 3, colors.outline, 2);
  line(img, cx + 7, cy, cx + 12 - dx * 2, cy + 4 + dy * 3, colors.outline, 2);
  ellipse(img, cx - 10 - dx * 2, cy + 4 + dy * 3, 3, 2, colors.chaser);
  ellipse(img, cx + 10 - dx * 2, cy + 4 + dy * 3, 3, 2, colors.chaser);
  setPixel(img, cx - 2 + dx * 2, cy - 3 + dy * 2, colors.chaserLight);
  setPixel(img, cx + 2 + dx * 2, cy - 3 + dy * 2, colors.chaserLight);
  return img;
}

function drawSwarm(direction = "south") {
  const img = createImage(32, 32);
  const [dx, dy] = dirVector[direction];
  const bodies = [
    [15, 15, 4],
    [20, 18, 3],
    [11, 19, 3],
    [17, 22, 2]
  ];
  for (const [x, y, r] of bodies) {
    ellipse(img, x - dx * 1.5, y - dy * 1.5, r + 1, r, colors.outline);
    ellipse(img, x - dx * 1.5, y - dy * 1.5, r, Math.max(1, r - 1), colors.swarmDark);
    setPixel(img, x + dx * 2, y + dy * 2, colors.swarm);
    setPixel(img, x + dx * 2 + 1, y + dy * 2, colors.chaserLight);
  }
  return img;
}

function drawTank(direction = "south") {
  const img = createImage(48, 48);
  const [dx, dy] = dirVector[direction];
  const cx = 24;
  const cy = 25;
  ellipse(img, cx, cy + 12, 12, 3, 0x00000044);
  ellipse(img, cx, cy, 16, 13, colors.outline);
  ellipse(img, cx, cy, 13, 10, colors.tankDark);
  ellipse(img, cx, cy - 3, 10, 6, colors.tank);
  rect(img, cx - 8, cy - 11, 16, 5, colors.tankLight);
  line(img, cx - 15, cy + 1, cx - 21 - dx * 3, cy + 8 + dy * 4, colors.outline, 4);
  line(img, cx + 15, cy + 1, cx + 21 - dx * 3, cy + 8 + dy * 4, colors.outline, 4);
  ellipse(img, cx - 20 - dx * 2, cy + 8 + dy * 3, 5, 3, colors.tank);
  ellipse(img, cx + 20 - dx * 2, cy + 8 + dy * 3, 5, 3, colors.tank);
  setPixel(img, cx - 3 + dx * 2, cy - 7 + dy * 2, colors.warning);
  setPixel(img, cx + 3 + dx * 2, cy - 7 + dy * 2, colors.warning);
  return img;
}

function drawBoss(direction = "south") {
  const img = createImage(64, 64);
  const [dx, dy] = dirVector[direction];
  const cx = 32;
  const cy = 34;
  ellipse(img, cx, cy + 18, 18, 5, 0x00000055);
  poly(img, [[cx, 8], [cx - 18, cy + 22], [cx - 10, cy + 28], [cx + 10, cy + 28], [cx + 18, cy + 22]], colors.outline);
  poly(img, [[cx, 11], [cx - 14, cy + 20], [cx - 8, cy + 25], [cx + 8, cy + 25], [cx + 14, cy + 20]], colors.bossRobe);
  ellipse(img, cx, 18, 12, 10, colors.outline);
  ellipse(img, cx, 19, 8, 7, colors.bossRobeLight);
  ellipse(img, cx, 22, 6, 5, colors.deepOutline);
  setPixel(img, cx - 3 + dx * 2, 21 + dy * 2, colors.curse);
  setPixel(img, cx + 3 + dx * 2, 21 + dy * 2, colors.curse);
  line(img, cx - 18, cy - 6, cx - 25, cy + 13, colors.outline, 4);
  line(img, cx - 18, cy - 6, cx - 25, cy + 13, colors.bone, 2);
  ellipse(img, cx - 25, cy + 14, 4, 4, colors.curse);
  line(img, cx + 13, cy - 4, cx + 22 + dx * 4, cy + 8 + dy * 3, colors.outline, 5);
  line(img, cx + 13, cy - 4, cx + 22 + dx * 4, cy + 8 + dy * 3, colors.bossRobeLight, 3);
  for (let i = 0; i < 8; i += 1) setPixel(img, cx - 6 + i * 2, cy + 18 + (i % 2), colors.curse);
  return img;
}

function drawWeaponIcon(type) {
  const img = createImage(32, 32);
  if (type === "dagger") {
    line(img, 17, 4, 14, 23, colors.outline, 4);
    line(img, 17, 4, 14, 23, colors.steel, 2);
    rect(img, 10, 21, 10, 3, colors.brass);
    rect(img, 13, 24, 3, 5, colors.leather);
  } else if (type === "fireball") {
    ellipse(img, 17, 18, 9, 9, 0xf04424ff);
    ellipse(img, 18, 18, 6, 6, 0xffa22eff);
    ellipse(img, 20, 18, 3, 3, 0xfff1a1ff);
    poly(img, [[12, 14], [8, 4], [18, 11]], 0xff6d2dff);
    poly(img, [[19, 13], [24, 4], [23, 17]], 0xffd05cff);
  } else if (type === "lightning") {
    poly(img, [[18, 2], [7, 17], [15, 16], [10, 30], [25, 12], [17, 13]], colors.outline);
    poly(img, [[18, 4], [10, 15], [17, 14], [13, 25], [23, 13], [16, 13]], 0x8beaffff);
  } else if (type === "meteor") {
    ellipse(img, 18, 18, 10, 9, 0x82210dff);
    ellipse(img, 20, 18, 6, 5, 0xff7e34ff);
    poly(img, [[12, 16], [3, 5], [16, 10]], 0xffc14aff);
    poly(img, [[20, 12], [22, 3], [26, 14]], 0xffe091ff);
  } else if (type === "orbit_blades") {
    ellipse(img, 16, 16, 12, 12, 0x75d7ff33);
    line(img, 7, 11, 14, 7, colors.steel, 2);
    line(img, 19, 25, 25, 18, colors.steel, 2);
    line(img, 24, 9, 26, 16, colors.steel, 2);
    ellipse(img, 16, 16, 3, 3, colors.brass);
  }
  return img;
}

function drawProjectile(type) {
  const img = createImage(16, 16);
  if (type === "dagger") {
    line(img, 4, 12, 12, 4, colors.steel, 2);
    setPixel(img, 12, 4, colors.steel);
  } else if (type === "fireball") {
    ellipse(img, 8, 8, 6, 5, 0xff8a2eff);
    ellipse(img, 9, 8, 3, 3, 0xfff1a1ff);
  } else if (type === "meteor") {
    ellipse(img, 8, 8, 7, 6, 0x6e1b0cff);
    ellipse(img, 9, 8, 4, 4, 0xff7e34ff);
  }
  return img;
}

function drawDeckTile() {
  const img = createImage(32, 32, colors.deck);
  for (let y = 0; y < 32; y += 8) line(img, 0, y, 31, y, colors.deckDark, 1);
  for (let x = 0; x < 32; x += 16) line(img, x, 0, x, 31, 0x5f3926ff, 1);
  rect(img, 2, 2, 28, 2, colors.deckLight);
  return img;
}

function drawTrimTile() {
  const img = createImage(32, 32, colors.deckDark);
  rect(img, 0, 0, 32, 8, colors.deckLight);
  rect(img, 0, 8, 32, 5, colors.deck);
  line(img, 0, 14, 31, 14, colors.outline, 1);
  return img;
}

function drawRailTile() {
  const img = createImage(32, 32);
  rect(img, 0, 5, 32, 6, colors.deckDark);
  rect(img, 0, 6, 32, 3, colors.deckLight);
  for (let x = 3; x < 32; x += 8) rect(img, x, 10, 3, 16, colors.deckDark);
  return img;
}

function drawCannon() {
  const img = createImage(64, 64);
  ellipse(img, 32, 40, 22, 5, 0x00000044);
  rect(img, 18, 34, 30, 8, colors.leather);
  rect(img, 16, 25, 34, 13, colors.outline);
  rect(img, 20, 27, 26, 9, 0x5d6c78ff);
  rect(img, 44, 29, 13, 5, colors.outline);
  rect(img, 45, 30, 10, 3, 0x8b98a4ff);
  ellipse(img, 22, 43, 5, 5, colors.deckDark);
  ellipse(img, 45, 43, 5, 5, colors.deckDark);
  return img;
}

function drawCannonball() {
  const img = createImage(32, 32);
  ellipse(img, 16, 17, 8, 8, colors.outline);
  ellipse(img, 15, 16, 6, 6, 0x39424dff);
  setPixel(img, 13, 13, 0x8b98a4ff);
  return img;
}

function drawRope() {
  const img = createImage(32, 32);
  for (let r = 11; r >= 5; r -= 3) ellipseOutline(img, 16, 16, r, Math.round(r * 0.7), 0xb39163ff, 2);
  return img;
}

function drawHatch() {
  const img = createImage(64, 64);
  rect(img, 12, 16, 40, 34, colors.outline);
  rect(img, 15, 19, 34, 28, colors.deckDark);
  for (let x = 18; x < 48; x += 7) line(img, x, 20, x, 46, colors.deckLight, 1);
  rect(img, 42, 31, 4, 4, colors.brass);
  return img;
}

function drawCargo() {
  const img = createImage(64, 64);
  rect(img, 11, 18, 36, 34, colors.outline);
  rect(img, 14, 21, 30, 28, colors.leather);
  line(img, 14, 30, 44, 30, colors.deckLight, 2);
  line(img, 25, 21, 25, 49, colors.deckDark, 2);
  rect(img, 42, 12, 11, 25, colors.outline);
  rect(img, 44, 14, 7, 21, 0x8c5d35ff);
  return img;
}

function drawMastBase() {
  const img = createImage(96, 96);
  ellipse(img, 48, 73, 30, 7, 0x00000044);
  ellipse(img, 48, 49, 25, 25, colors.outline);
  ellipse(img, 48, 49, 20, 20, colors.deckDark);
  rect(img, 39, 8, 18, 64, colors.outline);
  rect(img, 42, 10, 12, 60, colors.deck);
  for (let y = 14; y < 70; y += 11) line(img, 42, y, 53, y + 3, colors.deckLight, 1);
  return img;
}

function makeContactSheet(items, filePath, cellW = 96, cellH = 124) {
  const cols = Math.min(6, items.length);
  const rows = Math.ceil(items.length / cols);
  const sheet = createImage(cols * cellW, rows * cellH, 0x102433ff);
  const deck = drawDeckTile();
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;
    for (let yy = 0; yy < cellH; yy += 32) {
      for (let xx = 0; xx < cellW; xx += 32) copyImage(deck, sheet, x + xx, y + yy, 1);
    }
    copyImage(item.img, sheet, x + Math.floor((cellW - item.img.width) / 2), y + 8, 1);
    const scale = Math.max(2, Math.floor(Math.min((cellW - 16) / item.img.width, 4)));
    copyImage(item.img, sheet, x + Math.floor((cellW - item.img.width * scale) / 2), y + 48, scale);
  }
  savePng(filePath, sheet);
}

function writeSpriteSet(baseDir, drawer, names = directions) {
  const written = [];
  for (const direction of names) {
    const img = drawer(direction);
    const file = path.join(baseDir, "rotations", `${direction}.png`);
    savePng(file, img);
    written.push({ name: direction, img, file });
  }
  return written;
}

function backupAndCopy(src, dest) {
  if (fs.existsSync(dest)) {
    const rel = path.relative(runtimeRoot, dest);
    const backup = path.join(outRoot, "backups", rel);
    ensureDir(backup);
    if (!fs.existsSync(backup)) fs.copyFileSync(dest, backup);
  }
  ensureDir(dest);
  fs.copyFileSync(src, dest);
}

function main() {
  const playerDir = path.join(outRoot, "player");
  const enemyDir = path.join(outRoot, "enemies");
  const bossDir = path.join(outRoot, "boss");
  const weaponDir = path.join(outRoot, "weapons");
  const envDir = path.join(outRoot, "environment");
  const contactDir = path.join(outRoot, "contact_sheets");

  const playerSouth = drawPlayer("south");
  savePng(path.join(playerDir, "player_south_32.png"), playerSouth);
  const dash = drawDashSmear();
  savePng(path.join(playerDir, "player_dash_smear_32.png"), dash);
  const chaserSouth = drawChaser("south");
  savePng(path.join(enemyDir, "chaser_south_32.png"), chaserSouth);
  const swarmSouth = drawSwarm("south");
  savePng(path.join(enemyDir, "swarm_south_32.png"), swarmSouth);
  const tankSouth = drawTank("south");
  savePng(path.join(enemyDir, "tank_south_48.png"), tankSouth);
  const bossSouth = drawBoss("south");
  savePng(path.join(bossDir, "boss_south_64.png"), bossSouth);
  makeContactSheet([
    { name: "player", img: playerSouth },
    { name: "dash", img: dash },
    { name: "chaser", img: chaserSouth },
    { name: "swarm", img: swarmSouth },
    { name: "tank", img: tankSouth },
    { name: "boss", img: bossSouth }
  ], path.join(contactDir, "mb1-characters.png"));

  const weaponTypes = ["dagger", "fireball", "lightning", "meteor", "orbit_blades"];
  const weaponItems = [];
  for (const type of weaponTypes) {
    const img = drawWeaponIcon(type);
    savePng(path.join(weaponDir, `weapon_${type}_icon.png`), img);
    weaponItems.push({ name: type, img });
  }
  for (const type of ["dagger", "fireball", "meteor"]) {
    const img = drawProjectile(type);
    savePng(path.join(weaponDir, `proj_${type}.png`), img);
    weaponItems.push({ name: `proj_${type}`, img });
  }
  makeContactSheet(weaponItems, path.join(contactDir, "mb2-weapons.png"));

  const envItems = [
    ["deck_plank_main_32.png", drawDeckTile()],
    ["deck_plank_trim_32.png", drawTrimTile()],
    ["rail_32.png", drawRailTile()],
    ["cannon_64.png", drawCannon()],
    ["cannonball_32.png", drawCannonball()],
    ["rope_32.png", drawRope()],
    ["hatch_64.png", drawHatch()],
    ["cargo_64.png", drawCargo()],
    ["mast_base_96.png", drawMastBase()]
  ];
  for (const [name, img] of envItems) savePng(path.join(envDir, name), img);
  makeContactSheet(envItems.map(([name, img]) => ({ name, img })), path.join(contactDir, "mb3-environment.png"));

  const playerSet = writeSpriteSet(path.join(playerDir, "player_pirate"), drawPlayer);
  const chaserSet = writeSpriteSet(path.join(enemyDir, "chaser"), drawChaser);
  const swarmSet = writeSpriteSet(path.join(enemyDir, "swarm"), drawSwarm);
  const tankSet = writeSpriteSet(path.join(enemyDir, "tank"), drawTank);
  const bossSet = writeSpriteSet(path.join(bossDir, "miniboss_davy"), drawBoss);
  makeContactSheet([
    ...playerSet.map((entry) => ({ name: `player_${entry.name}`, img: entry.img })),
    ...chaserSet.map((entry) => ({ name: `chaser_${entry.name}`, img: entry.img })),
    ...swarmSet.map((entry) => ({ name: `swarm_${entry.name}`, img: entry.img })),
    ...tankSet.map((entry) => ({ name: `tank_${entry.name}`, img: entry.img })),
    ...bossSet.map((entry) => ({ name: `boss_${entry.name}`, img: entry.img }))
  ], path.join(contactDir, "mb4-directions.png"));

  for (const direction of directions) {
    backupAndCopy(
      path.join(playerDir, "player_pirate", "rotations", `${direction}.png`),
      path.join(runtimeRoot, "sprites/player/pirate/rotations", `${direction}.png`)
    );
    backupAndCopy(
      path.join(enemyDir, "chaser", "rotations", `${direction}.png`),
      path.join(runtimeRoot, "sprites/enemies/chaser/rotations", `${direction}.png`)
    );
    backupAndCopy(
      path.join(enemyDir, "swarm", "rotations", `${direction}.png`),
      path.join(runtimeRoot, "sprites/enemies/swarm/rotations", `${direction}.png`)
    );
    backupAndCopy(
      path.join(enemyDir, "tank", "rotations", `${direction}.png`),
      path.join(runtimeRoot, "sprites/enemies/tank/rotations", `${direction}.png`)
    );
    backupAndCopy(
      path.join(bossDir, "miniboss_davy", "rotations", `${direction}.png`),
      path.join(runtimeRoot, "sprites/enemies/miniboss_davy/rotations", `${direction}.png`)
    );
  }

  for (const type of weaponTypes) {
    backupAndCopy(
      path.join(weaponDir, `weapon_${type}_icon.png`),
      path.join(runtimeRoot, "sprites/weapons", `weapon_${type}_icon.png`)
    );
  }
  backupAndCopy(path.join(envDir, "deck_plank_main_32.png"), path.join(runtimeRoot, "sprites/environment/ship/deck_plank_main.png"));
  backupAndCopy(path.join(envDir, "deck_plank_trim_32.png"), path.join(runtimeRoot, "sprites/environment/ship/deck_plank_trim.png"));
  backupAndCopy(path.join(envDir, "cannon_64.png"), path.join(runtimeRoot, "sprites/environment/ship/terrain_cannon.png"));
  backupAndCopy(path.join(envDir, "cannonball_32.png"), path.join(runtimeRoot, "sprites/environment/ship/deck_cannonball.png"));
}

main();
