import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const redesignRoot = path.join(repoRoot, "assets/generated/redesign_v2");
const backupRoot = path.join(redesignRoot, "backups");
const promotionRoot = path.join(redesignRoot, "promotions");
const directions = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];

const actorFamilies = [
  {
    batch: "mb1-actors",
    family: "player_pirate",
    sourceDir: "assets/generated/redesign_v2/player_sheet_8dir/runtime_32/rotations",
    targetDir: "assets/sprites/player/pirate/rotations"
  },
  {
    batch: "mb1-actors",
    family: "enemy_chaser",
    sourceDir: "assets/generated/redesign_v2/enemies/chaser_sheet_8dir/runtime_24/rotations",
    targetDir: "assets/sprites/enemies/chaser/rotations"
  },
  {
    batch: "mb1-actors",
    family: "enemy_swarm",
    sourceDir: "assets/generated/redesign_v2/enemies/swarm_sheet_8dir/runtime_24/rotations",
    targetDir: "assets/sprites/enemies/swarm/rotations"
  },
  {
    batch: "mb1-actors",
    family: "enemy_tank",
    sourceDir: "assets/generated/redesign_v2/enemies/tank_sheet_8dir/runtime_32/rotations",
    targetDir: "assets/sprites/enemies/tank/rotations"
  },
  {
    batch: "mb1-actors",
    family: "enemy_miniboss_davy",
    sourceDir: "assets/generated/redesign_v2/boss/miniboss_davy_sheet_8dir/runtime_48/rotations",
    targetDir: "assets/sprites/enemies/miniboss_davy/rotations"
  },
  {
    batch: "mb2-projectiles",
    family: "boss_skull_bullet",
    sourceDir: "assets/generated/redesign_v2/projectiles/boss_skull_bullet_sheet_8dir/runtime_24/rotations",
    targetDir: "assets/sprites/projectiles/boss_skull_bullet/rotations"
  },
  {
    batch: "mb6-jellyfish",
    family: "enemy_jellyfish",
    sourceDir: "assets/generated/redesign_v2/enemies/jellyfish_sheet_8dir/runtime_32/rotations",
    targetDir: "assets/sprites/enemies/jellyfish/rotations"
  }
];

const fileCopies = [
  {
    batch: "mb2-weapons",
    family: "weapon_cutlass_icon",
    source: "assets/generated/redesign_v2/weapons/cutlass/replacement_candidates/weapon_dagger_icon.png",
    target: "assets/sprites/weapons/weapon_dagger_icon.png"
  },
  {
    batch: "mb2-weapons",
    family: "weapon_flintlock_icon",
    source: "assets/generated/redesign_v2/weapons/flintlock/replacement_candidates/weapon_fireball_icon.png",
    target: "assets/sprites/weapons/weapon_fireball_icon.png"
  },
  {
    batch: "mb2-weapons",
    family: "weapon_whip_icon",
    source: "assets/generated/redesign_v2/weapons/whip/replacement_candidates/weapon_lightning_icon.png",
    target: "assets/sprites/weapons/weapon_lightning_icon.png"
  },
  {
    batch: "mb2-weapons",
    family: "weapon_boarding_axe_icon",
    source: "assets/generated/redesign_v2/weapons/boarding_axe/replacement_candidates/weapon_orbit_blades_icon.png",
    target: "assets/sprites/weapons/weapon_orbit_blades_icon.png"
  },
  {
    batch: "mb3-environment",
    family: "deck_plank_main",
    source: "assets/generated/redesign_v2/environment/ship/replacement_candidates/deck_plank_main.png",
    target: "assets/sprites/environment/ship/deck_plank_main.png"
  },
  {
    batch: "mb3-environment",
    family: "deck_plank_trim",
    source: "assets/generated/redesign_v2/environment/ship/replacement_candidates/deck_plank_trim.png",
    target: "assets/sprites/environment/ship/deck_plank_trim.png"
  },
  {
    batch: "mb3-environment",
    family: "deck_cannon_loose",
    source: "assets/generated/redesign_v2/environment/ship/replacement_candidates/deck_cannon_loose.png",
    target: "assets/sprites/environment/ship/deck_cannon_loose.png"
  },
  {
    batch: "mb3-environment",
    family: "deck_cannonball",
    source: "assets/generated/redesign_v2/environment/ship/replacement_candidates/deck_cannonball.png",
    target: "assets/sprites/environment/ship/deck_cannonball.png"
  },
  {
    batch: "mb4-props",
    family: "cargo_crate",
    source: "assets/generated/redesign_v2/environment/ship/candidates/cargo_crate_32x32.png",
    target: "assets/sprites/environment/ship/cargo_crate.png"
  },
  {
    batch: "mb4-props",
    family: "barrel",
    source: "assets/generated/redesign_v2/environment/ship/candidates/barrel_32x32.png",
    target: "assets/sprites/environment/ship/barrel.png"
  },
  {
    batch: "mb4-props",
    family: "cargo_stack",
    source: "assets/generated/redesign_v2/environment/ship/candidates/cargo_stack_64x64.png",
    target: "assets/sprites/environment/ship/cargo_stack.png"
  },
  {
    batch: "mb4-props",
    family: "mast_base",
    source: "assets/generated/redesign_v2/environment/ship/candidates/mast_base_96x96.png",
    target: "assets/sprites/environment/ship/mast_base.png"
  },
  {
    batch: "mb4-props",
    family: "deck_winch",
    source: "assets/generated/redesign_v2/environment/ship/candidates/deck_winch_64x64.png",
    target: "assets/sprites/environment/ship/deck_winch.png"
  },
  {
    batch: "mb4-props",
    family: "deck_lantern",
    source: "assets/generated/redesign_v2/environment/ship/candidates/deck_lantern_32x32.png",
    target: "assets/sprites/environment/ship/deck_lantern.png"
  },
  {
    batch: "mb4-props",
    family: "rope_coil",
    source: "assets/generated/redesign_v2/environment/ship/candidates/rope_coil_32x32.png",
    target: "assets/sprites/environment/ship/rope_coil.png"
  },
  {
    batch: "mb4-props",
    family: "hatch_grate_square",
    source: "assets/generated/redesign_v2/environment/ship/candidates/hatch_grate_square_32x32.png",
    target: "assets/sprites/environment/ship/hatch_grate_square.png"
  },
  {
    batch: "mb4-props",
    family: "hatch_grate_large",
    source: "assets/generated/redesign_v2/environment/ship/candidates/hatch_grate_large_64x64.png",
    target: "assets/sprites/environment/ship/hatch_grate_large.png"
  },
  {
    batch: "mb4-props",
    family: "banner_skull_black",
    source: "assets/generated/redesign_v2/environment/ship/candidates/banner_skull_black_48x96.png",
    target: "assets/sprites/environment/ship/banner_skull_black.png"
  },
  {
    batch: "mb4-props",
    family: "rail_straight",
    source: "assets/generated/redesign_v2/environment/ship/candidates/rail_straight_96x36.png",
    target: "assets/sprites/environment/ship/rail_straight.png"
  },
  {
    batch: "mb5-map-variants",
    family: "ocean_tile",
    source: "assets/generated/redesign_v2/environment/ship/candidates/ocean_tile_64x64.png",
    target: "assets/sprites/environment/ship/ocean_tile.png"
  },
  {
    batch: "mb5-map-variants",
    family: "deck_plank_clean",
    source: "assets/generated/redesign_v2/environment/ship/candidates/deck_plank_clean_64x64.png",
    target: "assets/sprites/environment/ship/deck_plank_clean.png"
  },
  {
    batch: "mb5-map-variants",
    family: "deck_plank_damaged",
    source: "assets/generated/redesign_v2/environment/ship/candidates/deck_plank_damaged_64x64.png",
    target: "assets/sprites/environment/ship/deck_plank_damaged.png"
  }
];

const batchAliases = {
  all: ["mb1-actors", "mb2-projectiles", "mb2-weapons", "mb3-environment", "mb4-props", "mb5-map-variants", "mb6-jellyfish"],
  mb2: ["mb2-projectiles", "mb2-weapons"]
};

function usage() {
  console.log(`Usage:
  node scripts/promote-redesign-v2-assets.mjs --dry-run --batch <id>
  node scripts/promote-redesign-v2-assets.mjs --apply --batch <id>
  node scripts/promote-redesign-v2-assets.mjs --restore <promotion-manifest.json>

Batch ids: all, mb1-actors, mb2-projectiles, mb2-weapons, mb2, mb3-environment, mb4-props, mb5-map-variants, mb6-jellyfish`);
}

function parseArgs(argv) {
  const args = { dryRun: false, apply: false, batch: null, restore: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--batch") {
      args.batch = argv[i + 1];
      i += 1;
    } else if (arg === "--restore") {
      args.restore = argv[i + 1];
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function resolveRepoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readPngDimensions(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function normalizeBatchList(batch) {
  if (!batch) {
    return [];
  }
  return batchAliases[batch] ?? [batch];
}

function buildCopiesForBatch(batch) {
  const wanted = new Set(normalizeBatchList(batch));
  const copies = [];

  actorFamilies.forEach((family) => {
    if (!wanted.has(family.batch)) {
      return;
    }
    directions.forEach((direction) => {
      copies.push({
        batch: family.batch,
        family: family.family,
        direction,
        source: path.join(family.sourceDir, `${direction}.png`),
        target: path.join(family.targetDir, `${direction}.png`)
      });
    });
  });

  fileCopies.forEach((copy) => {
    if (wanted.has(copy.batch)) {
      copies.push(copy);
    }
  });

  return copies;
}

function validateDirectionalFamilies(batch) {
  const wanted = new Set(normalizeBatchList(batch));
  const errors = [];
  actorFamilies.forEach((family) => {
    if (!wanted.has(family.batch)) {
      return;
    }
    directions.forEach((direction) => {
      const sourcePath = resolveRepoPath(path.join(family.sourceDir, `${direction}.png`));
      if (!fs.existsSync(sourcePath)) {
        errors.push(`Missing ${family.family} ${direction}: ${path.relative(repoRoot, sourcePath)}`);
      }
    });
  });
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function summarizeCopy(copy) {
  const sourcePath = resolveRepoPath(copy.source);
  const targetPath = resolveRepoPath(copy.target);
  const sourceStats = fs.existsSync(sourcePath) ? fs.statSync(sourcePath) : null;
  const targetStats = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;
  return {
    ...copy,
    sourceExists: Boolean(sourceStats),
    targetExists: Boolean(targetStats),
    sourceBytes: sourceStats?.size ?? 0,
    targetBytes: targetStats?.size ?? 0,
    sourceDimensions: readPngDimensions(sourcePath),
    targetDimensions: readPngDimensions(targetPath),
    status: targetStats ? "overwrite" : "create"
  };
}

function createBackupPath(target, backupId) {
  return path.join(backupRoot, backupId, target);
}

function applyCopies(copies, backupId) {
  const manifest = {
    id: backupId,
    createdAt: new Date().toISOString(),
    copies: []
  };

  copies.forEach((copy) => {
    const sourcePath = resolveRepoPath(copy.source);
    const targetPath = resolveRepoPath(copy.target);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing source: ${copy.source}`);
    }

    const backupPath = createBackupPath(copy.target, backupId);
    const hadTarget = fs.existsSync(targetPath);
    if (hadTarget) {
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(targetPath, backupPath);
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);

    manifest.copies.push({
      ...copy,
      hadTarget,
      backup: hadTarget ? path.relative(repoRoot, backupPath) : null,
      sourceDimensions: readPngDimensions(sourcePath),
      targetDimensions: readPngDimensions(targetPath)
    });
  });

  fs.mkdirSync(promotionRoot, { recursive: true });
  const manifestPath = path.join(promotionRoot, `${backupId}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

function restore(manifestInput) {
  const manifestPath = path.isAbsolute(manifestInput) ? manifestInput : resolveRepoPath(manifestInput);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.copies.forEach((copy) => {
    const targetPath = resolveRepoPath(copy.target);
    if (copy.hadTarget && copy.backup) {
      const backupPath = resolveRepoPath(copy.backup);
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Missing backup: ${copy.backup}`);
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(backupPath, targetPath);
    } else if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  });
  console.log(`Restored ${manifest.copies.length} files from ${path.relative(repoRoot, manifestPath)}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.restore) {
    restore(args.restore);
    return;
  }
  if (args.dryRun === args.apply || !args.batch) {
    usage();
    process.exit(1);
  }

  validateDirectionalFamilies(args.batch);
  const copies = buildCopiesForBatch(args.batch);
  if (copies.length === 0) {
    throw new Error(`No copies found for batch: ${args.batch}`);
  }

  const summaries = copies.map(summarizeCopy);
  const missing = summaries.filter((copy) => !copy.sourceExists);
  if (missing.length > 0) {
    throw new Error(missing.map((copy) => `Missing source: ${copy.source}`).join("\n"));
  }

  summaries.forEach((copy) => {
    const srcDim = copy.sourceDimensions ? `${copy.sourceDimensions.width}x${copy.sourceDimensions.height}` : "unknown";
    const dstDim = copy.targetDimensions ? `${copy.targetDimensions.width}x${copy.targetDimensions.height}` : "-";
    console.log(
      `${copy.status.padEnd(9)} ${copy.batch.padEnd(17)} ${copy.source} -> ${copy.target} (${srcDim}, ${copy.sourceBytes} bytes; target ${dstDim})`
    );
  });

  if (args.dryRun) {
    console.log(`Dry run OK: ${summaries.length} files`);
    return;
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
  const manifestPath = applyCopies(copies, `${stamp}-${args.batch}`);
  console.log(`Applied ${summaries.length} files`);
  console.log(`Promotion manifest: ${path.relative(repoRoot, manifestPath)}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
