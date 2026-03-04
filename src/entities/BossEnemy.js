import { Enemy } from "./Enemy.js";

export class BossEnemy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, {
      type: "boss",
      hp: 420,
      speed: 46,
      damage: 28,
      xpValue: 180,
      radius: 28,
      scale: 1.9,
      tint: 0x6d34ff
    });

    this.setData("isBoss", true);
  }
}
