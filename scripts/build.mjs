import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const DIST_ASSETS_DIR = path.join(DIST_DIR, "assets");
const BUILD_MAX_BYTES = 10 * 1024 * 1024;

async function ensureCleanDist() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_ASSETS_DIR, { recursive: true });
}

async function copyRecursive(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
      continue;
    }
    await fs.copyFile(srcPath, destPath);
  }
}

async function writeOptimizedIndex() {
  const src = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
  const next = src.replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/, '<script type="module" src="./assets/main.min.js"></script>');
  await fs.writeFile(path.join(DIST_DIR, "index.html"), next, "utf8");
}

async function bundleMinifiedJs() {
  await build({
    entryPoints: [path.join(ROOT, "src/main.js")],
    outfile: path.join(DIST_ASSETS_DIR, "main.min.js"),
    bundle: true,
    minify: true,
    target: ["es2018"],
    format: "esm",
    sourcemap: false,
    legalComments: "none"
  });
}

async function compressFile(filePath) {
  const content = await fs.readFile(filePath);
  const gz = gzipSync(content, { level: 9 });
  const br = brotliCompressSync(content, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11
    }
  });
  await fs.writeFile(`${filePath}.gz`, gz);
  await fs.writeFile(`${filePath}.br`, br);
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

async function compressBuildFiles() {
  const files = await walkFiles(DIST_DIR);
  const targetExtensions = new Set([".js", ".css", ".html", ".json", ".png", ".wav"]);
  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (!targetExtensions.has(ext)) {
      continue;
    }
    await compressFile(filePath);
  }
}

async function getDirectorySizeBytes(dir) {
  const files = await walkFiles(dir);
  let total = 0;
  for (const filePath of files) {
    if (filePath.endsWith(".gz") || filePath.endsWith(".br")) {
      continue;
    }
    const stat = await fs.stat(filePath);
    total += stat.size;
  }
  return total;
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

async function run() {
  await ensureCleanDist();
  await bundleMinifiedJs();
  await writeOptimizedIndex();
  await fs.copyFile(path.join(ROOT, "styles.css"), path.join(DIST_DIR, "styles.css"));
  await copyRecursive(path.join(ROOT, "assets"), path.join(DIST_DIR, "assets"));
  await compressBuildFiles();

  const rawSizeBytes = await getDirectorySizeBytes(DIST_DIR);
  console.log(`[build] Raw size: ${formatMb(rawSizeBytes)} (${rawSizeBytes} bytes)`);
  if (rawSizeBytes > BUILD_MAX_BYTES) {
    throw new Error(`[build] Build size exceeded 10MB target: ${formatMb(rawSizeBytes)}`);
  }
  console.log("[build] Build size target (<10MB) satisfied.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

