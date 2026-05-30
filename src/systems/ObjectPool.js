import { Enemy } from "../entities/Enemy.js";

const DEFAULT_POOL_SIZE = 420;

export class ObjectPool {
  constructor(scene, group, config = {}) {
    this.scene = scene;
    this.group = group;
    this.initialSize = config.initialSize ?? DEFAULT_POOL_SIZE;

    this.available = [];
    this.preallocate();
  }

  preallocate() {
    for (let i = 0; i < this.initialSize; i += 1) {
      const enemy = new Enemy(this.scene, -1000, -1000, { type: "chaser" });
      enemy.setData("pooledEnemy", true);
      this.group.add(enemy);
      this.release(enemy);
    }
  }

  acquire(type, spawnConfig = {}) {
    if (this.available.length === 0) {
      return null;
    }

    const enemy = this.available.pop();
    enemy.resetForSpawn({ ...spawnConfig, type });
    return enemy;
  }

  release(enemy) {
    if (!enemy || enemy.getData("pooledEnemy") !== true) {
      return;
    }
    if (enemy.getData("inPool") === true) {
      return;
    }

    enemy.setData("inPool", true);
    enemy.resetForPool();
    this.available.push(enemy);
  }
}
