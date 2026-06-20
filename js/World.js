// World model: chunk storage, procedural terrain generation, and block access.

import { Noise } from "./noise.js";
import { BLOCK } from "./blocks.js";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const SEA_LEVEL = 26;

function chunkKey(cx, cz) {
  return cx + "," + cz;
}

function blockIndex(x, y, z) {
  // x,z in [0,CHUNK_SIZE), y in [0,WORLD_HEIGHT)
  return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
}

export class World {
  constructor(seed = 1337) {
    this.seed = seed;
    this.noise = new Noise(seed);
    this.treeNoise = new Noise(seed + 7919);
    this.chunks = new Map();
  }

  hasChunk(cx, cz) {
    return this.chunks.has(chunkKey(cx, cz));
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz));
  }

  ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = { cx, cz, data: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT) };
      this.generateChunk(chunk);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  // Surface height for a world column (top solid block y).
  columnHeight(wx, wz) {
    const base = this.noise.fbm(wx / 64, wz / 64, 4, 0.5, 2.0);
    const detail = this.noise.fbm(wx / 18, wz / 18, 3, 0.5, 2.0) * 0.25;
    const h = SEA_LEVEL + Math.round((base + detail) * 14);
    return Math.max(1, Math.min(WORLD_HEIGHT - 8, h));
  }

  generateChunk(chunk) {
    const { cx, cz, data } = chunk;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const height = this.columnHeight(wx, wz);

        for (let y = 0; y <= height; y++) {
          let id;
          if (y === height) {
            if (height <= SEA_LEVEL) id = BLOCK.SAND;
            else id = BLOCK.GRASS;
          } else if (y >= height - 3) {
            id = height <= SEA_LEVEL ? BLOCK.SAND : BLOCK.DIRT;
          } else {
            id = BLOCK.STONE;
          }
          data[blockIndex(x, y, z)] = id;
        }

        // Fill water up to sea level over low terrain.
        for (let y = height + 1; y <= SEA_LEVEL; y++) {
          data[blockIndex(x, y, z)] = BLOCK.WATER;
        }

        // Scatter trees on grassy land above the water line.
        if (height > SEA_LEVEL + 1 && x > 1 && x < CHUNK_SIZE - 2 && z > 1 && z < CHUNK_SIZE - 2) {
          const t = this.treeNoise.perlin2(wx * 0.9, wz * 0.9);
          if (t > 0.82) {
            this.plantTree(data, x, height + 1, z);
          }
        }
      }
    }
  }

  plantTree(data, x, baseY, z) {
    const trunkH = 4 + (Math.abs((x * 31 + z * 17) % 3));
    const topY = baseY + trunkH;
    for (let y = baseY; y < topY && y < WORLD_HEIGHT; y++) {
      data[blockIndex(x, y, z)] = BLOCK.WOOD;
    }
    // Leaf canopy as a small blob around the trunk top.
    for (let dy = -2; dy <= 1; dy++) {
      const ly = topY + dy;
      if (ly < 0 || ly >= WORLD_HEIGHT) continue;
      const radius = dy >= 1 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy < 0) continue;
          const lx = x + dx;
          const lz = z + dz;
          if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
          const idx = blockIndex(lx, ly, lz);
          if (data[idx] === BLOCK.AIR) data[idx] = BLOCK.LEAVES;
        }
      }
    }
  }

  // World-space block read. Out-of-range y is air; missing chunks read as 0.
  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BLOCK.AIR;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return chunk.data[blockIndex(lx, wy, lz)];
  }

  // World-space block write. Returns the list of chunk keys that changed
  // (the owning chunk plus neighbors when editing a border block).
  setBlock(wx, wy, wz, id) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return [];
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.ensureChunk(cx, cz);
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    chunk.data[blockIndex(lx, wy, lz)] = id;

    const dirty = new Set([chunkKey(cx, cz)]);
    if (lx === 0) dirty.add(chunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) dirty.add(chunkKey(cx + 1, cz));
    if (lz === 0) dirty.add(chunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) dirty.add(chunkKey(cx, cz + 1));
    return [...dirty];
  }
}

export { chunkKey, blockIndex };
