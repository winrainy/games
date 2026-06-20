// First-person input: pointer-lock mouse look, WASD movement intent, and
// mouse/number-key actions for breaking, placing, and hotbar selection.

import * as THREE from "../lib/three.module.js";

const PITCH_LIMIT = Math.PI / 2 - 0.01;

export class Controls {
  constructor(camera, domElement, handlers = {}) {
    this.camera = camera;
    this.dom = domElement;
    this.handlers = handlers;
    this.yaw = 0;
    this.pitch = 0;
    this.locked = false;
    this.keys = Object.create(null);

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();

    this.bind();
  }

  bind() {
    this.dom.addEventListener("click", () => {
      if (!this.locked) this.dom.requestPointerLock();
    });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.handlers.onLockChange) this.handlers.onLockChange(this.locked);
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const sensitivity = 0.0022;
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
      this.applyRotation();
    });

    this.dom.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      if (e.button === 0 && this.handlers.onBreak) this.handlers.onBreak();
      else if (e.button === 2 && this.handlers.onPlace) this.handlers.onPlace();
    });

    document.addEventListener("wheel", (e) => {
      if (!this.locked || !this.handlers.onScroll) return;
      this.handlers.onScroll(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "KeyF" && this.handlers.onToggleFly) this.handlers.onToggleFly();
      if (e.code.startsWith("Digit")) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && this.handlers.onSelect) this.handlers.onSelect(n - 1);
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
  }

  applyRotation() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  // Horizontal movement intent in world space, normalized, from WASD + yaw.
  getWishDir() {
    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    if (this._forward.lengthSq() < 1e-6) this._forward.set(0, 0, -1);
    this._forward.normalize();
    this._right.crossVectors(this._forward, this.camera.up).normalize();

    this._wish.set(0, 0, 0);
    if (this.keys["KeyW"]) this._wish.add(this._forward);
    if (this.keys["KeyS"]) this._wish.sub(this._forward);
    if (this.keys["KeyD"]) this._wish.add(this._right);
    if (this.keys["KeyA"]) this._wish.sub(this._right);
    if (this._wish.lengthSq() > 1e-6) this._wish.normalize();
    return this._wish;
  }

  get jumpPressed() {
    return !!this.keys["Space"];
  }

  get upPressed() {
    return !!this.keys["Space"];
  }

  get downPressed() {
    return !!(this.keys["ShiftLeft"] || this.keys["ShiftRight"]);
  }
}
