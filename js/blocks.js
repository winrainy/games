// Block type registry and procedurally generated pixel-art textures.
// Textures are generated on a canvas so there are zero binary asset files.

import * as THREE from "../lib/three.module.js";

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD: 5,
  LEAVES: 6,
  WATER: 7,
  PLANK: 8,
  GLASS: 9,
};

// Per-block face -> texture key. Faces default to "all" when top/side/bottom
// are not separately defined.
const BLOCK_DEFS = {
  [BLOCK.GRASS]: { top: "grass_top", side: "grass_side", bottom: "dirt", solid: true },
  [BLOCK.DIRT]: { all: "dirt", solid: true },
  [BLOCK.STONE]: { all: "stone", solid: true },
  [BLOCK.SAND]: { all: "sand", solid: true },
  [BLOCK.WOOD]: { top: "wood_top", side: "wood_side", bottom: "wood_top", solid: true },
  [BLOCK.LEAVES]: { all: "leaves", solid: true, transparent: true },
  [BLOCK.WATER]: { all: "water", solid: false, transparent: true, liquid: true },
  [BLOCK.PLANK]: { all: "plank", solid: true },
  [BLOCK.GLASS]: { all: "glass", solid: true, transparent: true },
};

// Base colors used to paint each texture (with per-pixel noise speckle).
const TEXTURE_COLORS = {
  grass_top: [88, 158, 62],
  grass_side: [120, 96, 64],
  dirt: [134, 96, 67],
  stone: [128, 128, 130],
  sand: [219, 205, 150],
  wood_top: [160, 124, 78],
  wood_side: [108, 82, 50],
  leaves: [56, 122, 48],
  water: [54, 110, 196],
  plank: [176, 138, 92],
  glass: [200, 224, 230],
};

function makeCanvasTexture(key) {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const [r, g, b] = TEXTURE_COLORS[key];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Deterministic speckle keeps each block face looking textured.
      const n = (Math.sin((x * 12.9898 + y * 78.233 + key.length) * 43758.5453) % 1 + 1) % 1;
      const shade = (n - 0.5) * 36;
      ctx.fillStyle = `rgb(${clamp(r + shade)},${clamp(g + shade)},${clamp(b + shade)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Grass side gets a green band along the top edge.
  if (key === "grass_side") {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < size; x++) {
        const n = (Math.sin((x * 1.7 + y * 9.1) * 17.0) % 1 + 1) % 1;
        const shade = (n - 0.5) * 30;
        ctx.fillStyle = `rgb(${clamp(88 + shade)},${clamp(158 + shade)},${clamp(62 + shade)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Wood log rings on the top face.
  if (key === "wood_top") {
    ctx.strokeStyle = "rgba(90,66,40,0.8)";
    ctx.beginPath();
    ctx.arc(8, 8, 5, 0, Math.PI * 2);
    ctx.arc(8, 8, 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Glass border so it reads as a pane.
  if (key === "glass") {
    ctx.strokeStyle = "rgba(150,190,200,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// Lazily build all materials once. Returns a map: textureKey -> Material.
let materialCache = null;

export function getMaterials() {
  if (materialCache) return materialCache;
  materialCache = {};
  for (const key of Object.keys(TEXTURE_COLORS)) {
    const def = { map: makeCanvasTexture(key) };
    if (key === "water") {
      materialCache[key] = new THREE.MeshLambertMaterial({
        ...def,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
    } else if (key === "leaves") {
      materialCache[key] = new THREE.MeshLambertMaterial({
        ...def,
        transparent: true,
        opacity: 0.92,
        alphaTest: 0.1,
      });
    } else if (key === "glass") {
      materialCache[key] = new THREE.MeshLambertMaterial({
        ...def,
        transparent: true,
        opacity: 0.55,
      });
    } else {
      materialCache[key] = new THREE.MeshLambertMaterial(def);
    }
  }
  return materialCache;
}

export function isSolid(blockId) {
  const def = BLOCK_DEFS[blockId];
  return !!(def && def.solid);
}

export function isTransparent(blockId) {
  if (blockId === BLOCK.AIR) return true;
  const def = BLOCK_DEFS[blockId];
  return !!(def && def.transparent);
}

export function isLiquid(blockId) {
  const def = BLOCK_DEFS[blockId];
  return !!(def && def.liquid);
}

// Returns the texture key for a given block face direction.
// dir: 0=+x,1=-x,2=+y(top),3=-y(bottom),4=+z,5=-z
export function faceTexture(blockId, dir) {
  const def = BLOCK_DEFS[blockId];
  if (!def) return "stone";
  if (def.all) return def.all;
  if (dir === 2) return def.top || def.side;
  if (dir === 3) return def.bottom || def.side;
  return def.side;
}

// Block ids selectable in the hotbar, in display order.
export const HOTBAR = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.SAND,
  BLOCK.WOOD,
  BLOCK.PLANK,
  BLOCK.LEAVES,
  BLOCK.GLASS,
  BLOCK.WATER,
];

// CSS color representing a block (its top face base color), for the hotbar UI.
export function blockSwatchColor(id) {
  const key = faceTexture(id, 2);
  const c = TEXTURE_COLORS[key] || [128, 128, 128];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const BLOCK_NAME = {
  [BLOCK.GRASS]: "草方块",
  [BLOCK.DIRT]: "泥土",
  [BLOCK.STONE]: "石头",
  [BLOCK.SAND]: "沙子",
  [BLOCK.WOOD]: "原木",
  [BLOCK.PLANK]: "木板",
  [BLOCK.LEAVES]: "树叶",
  [BLOCK.GLASS]: "玻璃",
  [BLOCK.WATER]: "水",
};
