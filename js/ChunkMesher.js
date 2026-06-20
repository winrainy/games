// Builds a renderable mesh for a chunk, emitting only faces that are visible
// (i.e. exposed to a transparent neighbor). Faces are grouped by texture so
// each group can use its own material.

import * as THREE from "../lib/three.module.js";
import { CHUNK_SIZE, WORLD_HEIGHT } from "./World.js";
import { BLOCK, isTransparent, faceTexture, getMaterials } from "./blocks.js";

// dir index: 0=+x,1=-x,2=+y,3=-y,4=+z,5=-z
const FACES = [
  { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]] },
  { dir: [0, 0, 1], corners: [[0, 1, 1], [1, 1, 1], [0, 0, 1], [1, 0, 1]] },
  { dir: [0, 0, -1], corners: [[1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0]] },
];

const FACE_UV = [[0, 1], [1, 1], [0, 0], [1, 0]];
const FACE_INDEX = [0, 1, 2, 2, 1, 3];

export function buildChunkMesh(world, cx, cz) {
  const groups = new Map(); // textureKey -> { positions, normals, uvs, indices }

  const getGroup = (key) => {
    let g = groups.get(key);
    if (!g) {
      g = { positions: [], normals: [], uvs: [], indices: [] };
      groups.set(key, g);
    }
    return g;
  };

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = cx * CHUNK_SIZE + x;
      const wz = cz * CHUNK_SIZE + z;
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const id = world.getBlock(wx, y, wz);
        if (id === BLOCK.AIR) continue;

        for (let f = 0; f < 6; f++) {
          const dir = FACES[f].dir;
          const nId = world.getBlock(wx + dir[0], y + dir[1], wz + dir[2]);
          // Render a face when its neighbour is see-through and not the same
          // block type (avoids internal water/leaves/glass faces).
          if (!isTransparent(nId) || nId === id) continue;

          const key = faceTexture(id, f);
          const g = getGroup(key);
          const baseIndex = g.positions.length / 3;

          for (let c = 0; c < 4; c++) {
            const corner = FACES[f].corners[c];
            g.positions.push(wx + corner[0], y + corner[1], wz + corner[2]);
            g.normals.push(dir[0], dir[1], dir[2]);
            g.uvs.push(FACE_UV[c][0], FACE_UV[c][1]);
          }
          for (const i of FACE_INDEX) g.indices.push(baseIndex + i);
        }
      }
    }
  }

  const materials = getMaterials();
  const meshGroup = new THREE.Group();
  meshGroup.name = `chunk:${cx},${cz}`;

  for (const [key, g] of groups) {
    if (g.indices.length === 0) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(g.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(g.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(g.uvs, 2));
    geometry.setIndex(g.indices);
    const mesh = new THREE.Mesh(geometry, materials[key]);
    mesh.frustumCulled = true;
    meshGroup.add(mesh);
  }

  return meshGroup;
}
