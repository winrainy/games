// Player physics: AABB collision against the voxel world, gravity, jumping,
// and an optional creative fly mode.

import * as THREE from "../lib/three.module.js";
import { isSolid } from "./blocks.js";

const WIDTH = 0.6;
const HALF = WIDTH / 2;
const HEIGHT = 1.8;
const EYE = 1.62;
const GRAVITY = 28;
const JUMP_SPEED = 9;
const WALK_SPEED = 5.5;
const FLY_SPEED = 9;
const MAX_FALL = 55;

export class Player {
  constructor(world, spawn) {
    this.world = world;
    this.position = new THREE.Vector3(spawn.x, spawn.y, spawn.z); // feet position
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.onGround = false;
    this.flying = false;
  }

  get eyePosition() {
    return new THREE.Vector3(this.position.x, this.position.y + EYE, this.position.z);
  }

  toggleFly() {
    this.flying = !this.flying;
    this.velocity.set(0, 0, 0);
  }

  // wishDir: desired horizontal move direction in world space (already
  // rotated by yaw). jump/up/down are booleans from input.
  update(dt, wishDir, jump, up, down) {
    if (this.flying) {
      this.velocity.x = wishDir.x * FLY_SPEED;
      this.velocity.z = wishDir.z * FLY_SPEED;
      this.velocity.y = 0;
      if (up) this.velocity.y = FLY_SPEED;
      if (down) this.velocity.y = -FLY_SPEED;
    } else {
      this.velocity.x = wishDir.x * WALK_SPEED;
      this.velocity.z = wishDir.z * WALK_SPEED;
      this.velocity.y -= GRAVITY * dt;
      if (this.velocity.y < -MAX_FALL) this.velocity.y = -MAX_FALL;
      if (jump && this.onGround) {
        this.velocity.y = JUMP_SPEED;
        this.onGround = false;
      }
    }

    this.onGround = false;
    this.moveAxis("x", this.velocity.x * dt);
    this.moveAxis("z", this.velocity.z * dt);
    this.moveAxis("y", this.velocity.y * dt);
  }

  moveAxis(axis, amount) {
    if (amount === 0) return;
    this.position[axis] += amount;
    this.resolveCollision(axis, amount);
  }

  // After moving along one axis, push the player out of any solid block it
  // now overlaps and zero the velocity on that axis.
  resolveCollision(axis, amount) {
    const p = this.position;
    const minX = Math.floor(p.x - HALF);
    const maxX = Math.floor(p.x + HALF);
    const minY = Math.floor(p.y);
    const maxY = Math.floor(p.y + HEIGHT);
    const minZ = Math.floor(p.z - HALF);
    const maxZ = Math.floor(p.z + HALF);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (!isSolid(this.world.getBlock(bx, by, bz))) continue;
          if (!this.intersectsBlock(bx, by, bz)) continue;

          if (axis === "x") {
            if (amount > 0) p.x = bx - HALF - 1e-3;
            else p.x = bx + 1 + HALF + 1e-3;
            this.velocity.x = 0;
          } else if (axis === "z") {
            if (amount > 0) p.z = bz - HALF - 1e-3;
            else p.z = bz + 1 + HALF + 1e-3;
            this.velocity.z = 0;
          } else {
            if (amount > 0) {
              p.y = by - HEIGHT - 1e-3;
            } else {
              p.y = by + 1 + 1e-3;
              this.onGround = true;
            }
            this.velocity.y = 0;
          }
          return;
        }
      }
    }
  }

  intersectsBlock(bx, by, bz) {
    const p = this.position;
    return (
      p.x + HALF > bx &&
      p.x - HALF < bx + 1 &&
      p.y + HEIGHT > by &&
      p.y < by + 1 &&
      p.z + HALF > bz &&
      p.z - HALF < bz + 1
    );
  }
}
