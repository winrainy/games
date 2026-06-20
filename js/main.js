// Entry point: wires the world, player, controls and renderer together,
// streams chunks around the player, and handles block break/place.

import * as THREE from "../lib/three.module.js";
import { World, CHUNK_SIZE, chunkKey } from "./World.js";
import { buildChunkMesh } from "./ChunkMesher.js";
import { Player } from "./Player.js";
import { Controls } from "./Controls.js";
import {
  BLOCK,
  HOTBAR,
  BLOCK_NAME,
  blockSwatchColor,
  isSolid,
  isLiquid,
} from "./blocks.js";

const RENDER_DISTANCE = 5; // chunks in each direction
const MESH_BUDGET = 2; // chunk (re)builds per frame to avoid hitches
const REACH = 6; // block interaction distance

class Game {
  constructor() {
    this.world = new World(20240620);
    this.meshes = new Map(); // chunkKey -> THREE.Group
    this.dirty = new Set(); // chunkKeys awaiting (re)mesh
    this.selected = 0;

    this.initRenderer();
    this.initScene();
    this.initPlayer();
    this.initControls();
    this.initHighlight();
    this.buildHotbar();
    this.primeSpawnArea();

    window.addEventListener("resize", () => this.onResize());

    this.clock = new THREE.Clock();
    this.lastHud = 0;
    this.frames = 0;
    this.fps = 0;
    this.fpsTimer = 0;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  initRenderer() {
    this.canvas = document.getElementById("game");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x87ceeb);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, RENDER_DISTANCE * CHUNK_SIZE * 0.55, RENDER_DISTANCE * CHUNK_SIZE);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x607050, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2cc, 0.8);
    sun.position.set(40, 80, 20);
    this.scene.add(sun);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  }

  initPlayer() {
    const sx = 8;
    const sz = 8;
    const h = this.world.columnHeight(sx, sz);
    this.player = new Player(this.world, { x: sx + 0.5, y: h + 2, z: sz + 0.5 });
  }

  initControls() {
    this.controls = new Controls(this.camera, this.canvas, {
      onBreak: () => this.breakBlock(),
      onPlace: () => this.placeBlock(),
      onSelect: (i) => this.selectSlot(i),
      onScroll: (d) => this.selectSlot((this.selected + d + HOTBAR.length) % HOTBAR.length),
      onToggleFly: () => {
        this.player.toggleFly();
        this.setStatus(this.player.flying ? "飞行模式：开" : "飞行模式：关");
      },
      onLockChange: (locked) => {
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.style.display = locked ? "none" : "flex";
      },
    });
  }

  initHighlight() {
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(box);
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);
  }

  buildHotbar() {
    const bar = document.getElementById("hotbar");
    bar.innerHTML = "";
    this.slotEls = [];
    HOTBAR.forEach((id, i) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      const swatch = document.createElement("div");
      swatch.className = "swatch";
      swatch.style.background = blockSwatchColor(id);
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = i + 1;
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = BLOCK_NAME[id] || "";
      slot.appendChild(swatch);
      slot.appendChild(key);
      slot.appendChild(name);
      bar.appendChild(slot);
      this.slotEls.push(slot);
    });
    this.selectSlot(0);
  }

  selectSlot(i) {
    this.selected = i;
    this.slotEls.forEach((el, idx) => el.classList.toggle("active", idx === i));
  }

  setStatus(text) {
    const el = document.getElementById("status");
    if (!el) return;
    el.textContent = text;
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => (el.textContent = ""), 1500);
  }

  // Generate + mesh the immediate spawn region synchronously so the player
  // has ground to stand on before the first frame.
  primeSpawnArea() {
    const pcx = Math.floor(this.player.position.x / CHUNK_SIZE);
    const pcz = Math.floor(this.player.position.z / CHUNK_SIZE);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.world.ensureChunk(pcx + dx, pcz + dz);
      }
    }
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.remeshChunk(pcx + dx, pcz + dz);
      }
    }
  }

  remeshChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    const old = this.meshes.get(key);
    if (old) {
      this.scene.remove(old);
      this.disposeGroup(old);
      this.meshes.delete(key);
    }
    const group = buildChunkMesh(this.world, cx, cz);
    this.meshes.set(key, group);
    this.scene.add(group);
  }

  disposeGroup(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
  }

  // Stream chunks: ensure data + meshes within render distance, drop the rest.
  updateChunks() {
    const pcx = Math.floor(this.player.position.x / CHUNK_SIZE);
    const pcz = Math.floor(this.player.position.z / CHUNK_SIZE);

    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = chunkKey(cx, cz);
        if (!this.meshes.has(key) && !this.dirty.has(key)) {
          this.dirty.add(key);
        }
      }
    }

    // Unload distant chunk meshes.
    const maxDist = RENDER_DISTANCE + 1;
    for (const key of [...this.meshes.keys()]) {
      const [cx, cz] = key.split(",").map(Number);
      if (Math.abs(cx - pcx) > maxDist || Math.abs(cz - pcz) > maxDist) {
        const group = this.meshes.get(key);
        this.scene.remove(group);
        this.disposeGroup(group);
        this.meshes.delete(key);
      }
    }
  }

  // Process a few queued chunks per frame, nearest first.
  processDirty() {
    if (this.dirty.size === 0) return;
    const pcx = Math.floor(this.player.position.x / CHUNK_SIZE);
    const pcz = Math.floor(this.player.position.z / CHUNK_SIZE);
    const sorted = [...this.dirty].sort((a, b) => {
      const [ax, az] = a.split(",").map(Number);
      const [bx, bz] = b.split(",").map(Number);
      const da = (ax - pcx) ** 2 + (az - pcz) ** 2;
      const db = (bx - pcx) ** 2 + (bz - pcz) ** 2;
      return da - db;
    });

    let built = 0;
    for (const key of sorted) {
      if (built >= MESH_BUDGET) break;
      const [cx, cz] = key.split(",").map(Number);
      // Ensure this chunk and its neighbours have block data before meshing
      // so faces along chunk borders are culled correctly.
      this.world.ensureChunk(cx, cz);
      this.world.ensureChunk(cx + 1, cz);
      this.world.ensureChunk(cx - 1, cz);
      this.world.ensureChunk(cx, cz + 1);
      this.world.ensureChunk(cx, cz - 1);
      this.remeshChunk(cx, cz);
      this.dirty.delete(key);
      built++;
    }
  }

  // Amanatides & Woo voxel traversal from the camera. Returns the first solid
  // block hit plus the face normal, or null.
  raycast() {
    const origin = this.player.eyePosition;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = Math.sign(dir.x);
    const stepY = Math.sign(dir.y);
    const stepZ = Math.sign(dir.z);

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    const distToBoundary = (s, o, st) =>
      st > 0 ? (Math.floor(o) + 1 - o) : (o - Math.floor(o));
    let tMaxX = dir.x !== 0 ? distToBoundary(x, origin.x, stepX) * tDeltaX : Infinity;
    let tMaxY = dir.y !== 0 ? distToBoundary(y, origin.y, stepY) * tDeltaY : Infinity;
    let tMaxZ = dir.z !== 0 ? distToBoundary(z, origin.z, stepZ) * tDeltaZ : Infinity;

    let nx = 0, ny = 0, nz = 0;
    let t = 0;
    while (t <= REACH) {
      if (isSolid(this.world.getBlock(x, y, z))) {
        return { x, y, z, nx, ny, nz };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }

  markDirtyForEdit(keys) {
    for (const key of keys) {
      const [cx, cz] = key.split(",").map(Number);
      this.remeshChunk(cx, cz);
    }
  }

  breakBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const keys = this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR);
    this.markDirtyForEdit(keys);
  }

  placeBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;

    const target = this.world.getBlock(px, py, pz);
    if (isSolid(target)) return; // never replace a solid block

    const id = HOTBAR[this.selected];
    // Don't place a solid block inside the player's body.
    if (isSolid(id) && this.playerIntersectsCell(px, py, pz)) return;

    const keys = this.world.setBlock(px, py, pz, id);
    this.markDirtyForEdit(keys);
  }

  playerIntersectsCell(bx, by, bz) {
    const p = this.player.position;
    const half = 0.3;
    const height = 1.8;
    return (
      p.x + half > bx && p.x - half < bx + 1 &&
      p.y + height > by && p.y < by + 1 &&
      p.z + half > bz && p.z - half < bz + 1
    );
  }

  updateHighlight() {
    const hit = this.raycast();
    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.highlight.visible = false;
    }
  }

  updateHud(dt) {
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
    }
    const hud = document.getElementById("hud-info");
    if (!hud) return;
    const p = this.player.position;
    hud.textContent =
      `XYZ ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}  |  ` +
      `FPS ${this.fps}  |  区块 ${this.meshes.size}` +
      (this.player.flying ? "  |  飞行" : "");
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    const wish = this.controls.getWishDir();
    this.player.update(dt, wish, this.controls.jumpPressed, this.controls.upPressed, this.controls.downPressed);

    const eye = this.player.eyePosition;
    this.camera.position.copy(eye);

    this.updateChunks();
    this.processDirty();
    this.updateHighlight();
    this.updateHud(dt);

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  // Surface module errors to the user instead of a blank screen.
  try {
    new Game();
  } catch (err) {
    console.error(err);
    const overlay = document.getElementById("overlay");
    if (overlay) {
      overlay.innerHTML = `<div class="panel"><h1>加载失败</h1><pre>${String(err && err.stack || err)}</pre></div>`;
      overlay.style.display = "flex";
    }
  }
});
