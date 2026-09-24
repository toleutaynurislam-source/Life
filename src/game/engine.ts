import {
  PlayerStats,
  Enemy,
  Projectile,
  DropItem,
  Particle,
  FloatingText,
  AttackVisual,
  HeroClass,
  Weapon,
} from './types';
import { HERO_CLASSES } from './heroes';
import { WEAPONS } from './weapons';
import { createEnemy, resetEnemyIdCounter } from './enemies';
import { sound } from './audio';

export interface GameEngineCallbacks {
  onLevelUp: (stats: PlayerStats) => void;
  onGameOver: (stats: PlayerStats) => void;
  onWaveComplete: (wave: number) => void;
  onStatsUpdate: (stats: PlayerStats) => void;
}

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private lastTime: number = 0;

  // Arena dimensions
  public arenaWidth: number = 1920;
  public arenaHeight: number = 1080;

  // Viewport camera
  public camera = { x: 0, y: 0, scale: 1 };
  private shakeTimer: number = 0;
  private shakeIntensity: number = 0;

  // Player state
  public player = {
    x: 960,
    y: 540,
    vx: 0,
    vy: 0,
    radius: 18,
    angle: 0,
    facingAngle: 0,
    attackCooldownTimer: 0,
    dashTimer: 0,
    dashCooldownTimer: 0,
    dashCooldownMax: 2.2,
    dashDuration: 0.22,
    dashSpeedMultiplier: 3.2,
    isInvulnerable: false,
    invulnerableTimer: 0,
    pickupRadius: 90,
  };

  public stats: PlayerStats;
  public callbacks: GameEngineCallbacks;

  // Entities
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public drops: DropItem[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public attackVisuals: AttackVisual[] = [];

  // Wave manager
  public wave: number = 1;
  public waveTimeRemaining: number = 30;
  public waveDuration: number = 35;
  public spawnTimer: number = 0;
  public enemiesSpawnedInWave: number = 0;
  public totalEnemiesInWave: number = 20;
  public waveState: 'spawning' | 'clearing' | 'intermission' = 'spawning';
  public intermissionTimer: number = 0;

  // Controls input
  public keys: Record<string, boolean> = {};
  public mousePos = { x: 0, y: 0, worldX: 0, worldY: 0, isDown: false };
  public virtualJoystick = { active: false, dx: 0, dy: 0 };
  public autoAttackEnabled: boolean = true;
  public isPaused: boolean = false;
  public isRunning: boolean = false;

  private nextEntityId: number = 1000;

  constructor(canvas: HTMLCanvasElement, heroClassId: string, callbacks: GameEngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.callbacks = callbacks;

    const hero: HeroClass = HERO_CLASSES[heroClassId as keyof typeof HERO_CLASSES] || HERO_CLASSES.knight;
    const startWeapon: Weapon = WEAPONS[hero.startingWeaponId];

    this.stats = {
      classId: hero.id,
      level: 1,
      xp: 0,
      xpToNextLevel: 45,
      gold: 0,
      kills: 0,
      wave: 1,
      hp: hero.baseHp,
      maxHp: hero.baseHp,
      moveSpeed: hero.speed,
      damageMultiplier: 1.0,
      rangeMultiplier: 1.0,
      cooldownReduction: 0,
      lifeSteal: 0,
      critChance: hero.critChance,
      critMultiplier: 2.0,
      weapon: { ...startWeapon },
      weaponLevel: 1,
    };

    resetEnemyIdCounter();
    this.setupWave(1);
    this.resize();
  }

  public resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.lastTime = performance.now();
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public triggerDash() {
    if (this.player.dashCooldownTimer <= 0 && (this.player.vx !== 0 || this.player.vy !== 0 || this.virtualJoystick.active)) {
      this.player.dashTimer = this.player.dashDuration;
      this.player.dashCooldownTimer = this.player.dashCooldownMax;
      this.player.isInvulnerable = true;
      sound.playDash();

      // Spawn dash ghost particles
      for (let i = 0; i < 8; i++) {
        this.particles.push({
          x: this.player.x + (Math.random() - 0.5) * 15,
          y: this.player.y + (Math.random() - 0.5) * 15,
          vx: -this.player.vx * 0.3,
          vy: -this.player.vy * 0.3,
          life: 0.25,
          maxLife: 0.25,
          color: 'rgba(56, 189, 248, 0.6)',
          size: 14,
        });
      }
    }
  }

  public switchWeapon(weaponId: keyof typeof WEAPONS) {
    const baseW = WEAPONS[weaponId];
    if (baseW) {
      this.stats.weapon = { ...baseW };
      this.player.attackCooldownTimer = 0;
      this.callbacks.onStatsUpdate(this.stats);
      sound.playSwing(1.3);
    }
  }

  private setupWave(waveNum: number) {
    this.wave = waveNum;
    this.stats.wave = waveNum;
    this.waveDuration = Math.min(60, 30 + waveNum * 4);
    this.waveTimeRemaining = this.waveDuration;
    this.enemiesSpawnedInWave = 0;
    this.totalEnemiesInWave = 15 + waveNum * 8;
    this.waveState = 'spawning';

    // Boss waves on wave 5 and 10+
    if (waveNum === 5) {
      this.spawnBoss('golem');
    } else if (waveNum === 10) {
      this.spawnBoss('void_lord');
    } else if (waveNum > 10 && waveNum % 5 === 0) {
      this.spawnBoss('void_lord');
    }

    this.addFloatingText(
      this.player.x,
      this.player.y - 60,
      waveNum === 5 ? 'БОСС-ВОЛНА: ГОЛЕМ' : waveNum === 10 ? 'ФИНАЛЬНЫЙ БОСС: ЛОРД ПУСТОТЫ' : `ВОЛНА ${waveNum}`,
      '#f59e0b',
      1.5
    );
  }

  private spawnBoss(bossType: 'golem' | 'void_lord') {
    const angle = Math.random() * Math.PI * 2;
    const dist = 550;
    const x = Math.max(80, Math.min(this.arenaWidth - 80, this.player.x + Math.cos(angle) * dist));
    const y = Math.max(80, Math.min(this.arenaHeight - 80, this.player.y + Math.sin(angle) * dist));
    const boss = createEnemy(bossType, x, y, this.wave);
    this.enemies.push(boss);
    this.triggerCameraShake(12, 0.6);
  }

  private loop = (currentTime: number) => {
    if (!this.isRunning) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (!this.isPaused) {
      this.update(dt);
    }

    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    // 1. Camera Shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      if (this.shakeTimer <= 0) this.shakeIntensity = 0;
    }

    // 2. Dash cooldowns and state
    if (this.player.dashTimer > 0) {
      this.player.dashTimer -= dt;
      if (this.player.dashTimer <= 0) {
        this.player.isInvulnerable = false;
      }
    }
    if (this.player.dashCooldownTimer > 0) {
      this.player.dashCooldownTimer -= dt;
    }
    if (this.player.invulnerableTimer > 0) {
      this.player.invulnerableTimer -= dt;
      if (this.player.invulnerableTimer <= 0) {
        this.player.isInvulnerable = false;
      }
    }

    // 3. Player Movement
    let mx = 0;
    let my = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) my -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) my += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;

    // Add virtual joystick
    if (this.virtualJoystick.active) {
      mx += this.virtualJoystick.dx;
      my += this.virtualJoystick.dy;
    }

    const moveLen = Math.hypot(mx, my);
    const effectiveSpeed =
      this.stats.moveSpeed *
      60 *
      (this.player.dashTimer > 0 ? this.player.dashSpeedMultiplier : 1);

    if (moveLen > 0.1) {
      this.player.vx = (mx / moveLen) * effectiveSpeed;
      this.player.vy = (my / moveLen) * effectiveSpeed;
      this.player.facingAngle = Math.atan2(this.player.vy, this.player.vx);
    } else {
      this.player.vx = 0;
      this.player.vy = 0;
    }

    this.player.x = Math.max(
      this.player.radius + 30,
      Math.min(this.arenaWidth - this.player.radius - 30, this.player.x + this.player.vx * dt)
    );
    this.player.y = Math.max(
      this.player.radius + 30,
      Math.min(this.arenaHeight - this.player.radius - 30, this.player.y + this.player.vy * dt)
    );

    // Aim towards mouse if mouse moved, or towards nearest enemy in range
    const nearestEnemy = this.getNearestEnemy(this.getEffectiveRange());
    if (this.mousePos.worldX !== 0 || this.mousePos.worldY !== 0) {
      this.player.angle = Math.atan2(this.mousePos.worldY - this.player.y, this.mousePos.worldX - this.player.x);
    } else if (nearestEnemy) {
      this.player.angle = Math.atan2(nearestEnemy.y - this.player.y, nearestEnemy.x - this.player.x);
    } else if (moveLen > 0.1) {
      this.player.angle = this.player.facingAngle;
    }

    // 4. Attack Handling
    const effectiveCooldown = this.stats.weapon.baseCooldown * (1 - this.stats.cooldownReduction);
    if (this.player.attackCooldownTimer > 0) {
      this.player.attackCooldownTimer -= dt;
    }

    const shouldAttack =
      (this.autoAttackEnabled && nearestEnemy !== null) ||
      this.mousePos.isDown ||
      this.keys['Space'];

    if (shouldAttack && this.player.attackCooldownTimer <= 0) {
      let targetAngle = this.player.angle;
      if (nearestEnemy) {
        targetAngle = Math.atan2(nearestEnemy.y - this.player.y, nearestEnemy.x - this.player.x);
        this.player.angle = targetAngle;
      }
      this.performAttack(targetAngle);
      this.player.attackCooldownTimer = effectiveCooldown;
    }

    // 5. Wave & Spawning
    this.updateWave(dt);

    // 6. Update Projectiles
    this.updateProjectiles(dt);

    // 7. Update Enemies
    this.updateEnemies(dt);

    // 8. Update Drops
    this.updateDrops(dt);

    // 9. Update Particles & Visuals
    this.updateParticles(dt);
    this.updateFloatingTexts(dt);
    this.updateAttackVisuals(dt);

    // 10. Update Camera position centering on player
    this.updateCamera();
  }

  private getEffectiveRange(): number {
    return this.stats.weapon.baseRange * this.stats.rangeMultiplier;
  }

  public getEffectiveDamage(): { damage: number; isCrit: boolean } {
    const isCrit = Math.random() < this.stats.critChance;
    const base = this.stats.weapon.baseDamage * this.stats.damageMultiplier;
    const finalDamage = Math.round(isCrit ? base * this.stats.critMultiplier : base);
    return { damage: finalDamage, isCrit };
  }

  private performAttack(angle: number) {
    const range = this.getEffectiveRange();
    const weapon = this.stats.weapon;
    const { damage, isCrit } = this.getEffectiveDamage();

    switch (weapon.type) {
      case 'arc': {
        // Sword or Daggers swing arc
        sound.playSwing(weapon.id === 'daggers' ? 1.4 : 1.0);
        this.attackVisuals.push({
          type: 'arc',
          x: this.player.x,
          y: this.player.y,
          angle,
          range,
          spreadAngle: weapon.spreadAngle || Math.PI * 0.8,
          life: 0.18,
          maxLife: 0.18,
          color: weapon.color,
        });

        // Hit enemies inside sector
        const halfSpread = (weapon.spreadAngle || Math.PI * 0.8) / 2;
        let hitCount = 0;
        for (const enemy of this.enemies) {
          const dx = enemy.x - this.player.x;
          const dy = enemy.y - this.player.y;
          const dist = Math.hypot(dx, dy);

          if (dist <= range + enemy.radius) {
            const enemyAngle = Math.atan2(dy, dx);
            let angleDiff = Math.abs(enemyAngle - angle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

            if (angleDiff <= halfSpread) {
              this.damageEnemy(enemy, damage, isCrit, dx / (dist || 1), dy / (dist || 1), weapon.knockback);
              hitCount++;
            }
          }
        }
        if (hitCount > 0) sound.playHit(isCrit);
        break;
      }

      case 'thrust': {
        // Spear piercing thrust
        sound.playSwing(1.2);
        this.attackVisuals.push({
          type: 'thrust',
          x: this.player.x,
          y: this.player.y,
          angle,
          range,
          spreadAngle: weapon.spreadAngle || Math.PI * 0.35,
          life: 0.22,
          maxLife: 0.22,
          color: weapon.color,
        });

        const halfSpread = (weapon.spreadAngle || Math.PI * 0.35) / 2;
        let hitCount = 0;
        for (const enemy of this.enemies) {
          const dx = enemy.x - this.player.x;
          const dy = enemy.y - this.player.y;
          const dist = Math.hypot(dx, dy);

          if (dist <= range + enemy.radius) {
            const enemyAngle = Math.atan2(dy, dx);
            let angleDiff = Math.abs(enemyAngle - angle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

            if (angleDiff <= halfSpread) {
              this.damageEnemy(enemy, damage, isCrit, Math.cos(angle), Math.sin(angle), weapon.knockback);
              hitCount++;
            }
          }
        }
        if (hitCount > 0) sound.playHit(isCrit);
        break;
      }

      case 'circle': {
        // Warhammer 360 AoE slam
        sound.playImpact();
        this.triggerCameraShake(8, 0.3);
        this.attackVisuals.push({
          type: 'circle',
          x: this.player.x,
          y: this.player.y,
          angle: 0,
          range,
          life: 0.3,
          maxLife: 0.3,
          color: weapon.color,
        });

        let hitCount = 0;
        for (const enemy of this.enemies) {
          const dx = enemy.x - this.player.x;
          const dy = enemy.y - this.player.y;
          const dist = Math.hypot(dx, dy);

          if (dist <= range + enemy.radius) {
            this.damageEnemy(enemy, damage, isCrit, dx / (dist || 1), dy / (dist || 1), weapon.knockback);
            hitCount++;
          }
        }
        if (hitCount > 0) sound.playHit(isCrit);
        break;
      }

      case 'projectile': {
        // Bow arrow
        sound.playShoot(false);
        const speed = weapon.projectileSpeed || 600;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 5,
          damage,
          isPlayer: true,
          color: weapon.color,
          distanceTraveled: 0,
          maxDistance: range,
        });
        break;
      }

      case 'aoe_burst': {
        // Arcane staff exploding orb
        sound.playShoot(true);
        const speed = weapon.projectileSpeed || 450;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 8,
          damage,
          isPlayer: true,
          color: weapon.color,
          distanceTraveled: 0,
          maxDistance: range,
          aoeRadius: weapon.aoeRadius || 80,
        });
        break;
      }
    }
  }

  private damageEnemy(enemy: Enemy, damage: number, isCrit: boolean, kx: number, ky: number, knockback: number) {
    enemy.hp -= damage;
    enemy.flashTimer = 0.15;
    enemy.vx += kx * knockback * 8;
    enemy.vy += ky * knockback * 8;

    // Floating text
    this.addFloatingText(
      enemy.x + (Math.random() - 0.5) * 16,
      enemy.y - 12,
      `${damage}`,
      isCrit ? '#fbbf24' : '#ffffff',
      isCrit ? 1.4 : 1.0,
      isCrit
    );

    // Life steal
    if (this.stats.lifeSteal > 0) {
      const healAmount = Math.max(1, Math.round(damage * this.stats.lifeSteal));
      const oldHp = this.stats.hp;
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + healAmount);
      if (this.stats.hp > oldHp && Math.random() < 0.4) {
        this.addFloatingText(this.player.x, this.player.y - 25, `+${healAmount}`, '#4ade80', 0.9);
      }
    }

    // Impact sparks
    for (let i = 0; i < (isCrit ? 8 : 4); i++) {
      this.particles.push({
        x: enemy.x,
        y: enemy.y,
        vx: (Math.random() - 0.5) * 160 + kx * 80,
        vy: (Math.random() - 0.5) * 160 + ky * 80,
        life: 0.25,
        maxLife: 0.25,
        color: isCrit ? '#fef08a' : enemy.accentColor,
        size: Math.random() * 3 + 2,
      });
    }

    // Check death
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: Enemy) {
    this.stats.kills++;

    // Death explosion particles
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: enemy.x,
        y: enemy.y,
        vx: (Math.random() - 0.5) * 220,
        vy: (Math.random() - 0.5) * 220,
        life: 0.4,
        maxLife: 0.4,
        color: enemy.color,
        size: Math.random() * 5 + 3,
      });
    }

    // Spawn XP drop
    this.drops.push({
      id: this.nextEntityId++,
      type: 'xp',
      x: enemy.x + (Math.random() - 0.5) * 10,
      y: enemy.y + (Math.random() - 0.5) * 10,
      value: enemy.xpValue,
      radius: 6,
      color: enemy.xpValue > 40 ? '#c084fc' : enemy.xpValue > 20 ? '#38bdf8' : '#4ade80',
      creationTime: performance.now(),
    });

    // Spawn Gold drop
    if (Math.random() < 0.65 || enemy.isBoss) {
      this.drops.push({
        id: this.nextEntityId++,
        type: 'gold',
        x: enemy.x + (Math.random() - 0.5) * 14,
        y: enemy.y + (Math.random() - 0.5) * 14,
        value: enemy.goldValue,
        radius: 5,
        color: '#facc15',
        creationTime: performance.now(),
      });
    }

    // Rare heal drop
    if (Math.random() < 0.08) {
      this.drops.push({
        id: this.nextEntityId++,
        type: 'heal',
        x: enemy.x,
        y: enemy.y,
        value: 30,
        radius: 7,
        color: '#ef4444',
        creationTime: performance.now(),
      });
    }

    // Remove from array
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }
  }

  private updateWave(dt: number) {
    if (this.waveState === 'spawning') {
      this.waveTimeRemaining -= dt;
      this.spawnTimer += dt;

      const spawnInterval = Math.max(0.4, 2.0 - this.wave * 0.15);

      if (this.spawnTimer >= spawnInterval && this.enemiesSpawnedInWave < this.totalEnemiesInWave) {
        this.spawnTimer = 0;
        this.spawnWaveEnemy();
      }

      if (this.waveTimeRemaining <= 0 || this.enemiesSpawnedInWave >= this.totalEnemiesInWave) {
        this.waveState = 'clearing';
      }
    } else if (this.waveState === 'clearing') {
      // Wait until all enemies in wave are eliminated
      if (this.enemies.length === 0) {
        this.waveState = 'intermission';
        this.intermissionTimer = 3.5;
        this.stats.gold += 25 + this.wave * 10;
        sound.playLevelUp();
        this.callbacks.onWaveComplete(this.wave);
        this.callbacks.onStatsUpdate(this.stats);
      }
    } else if (this.waveState === 'intermission') {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) {
        this.setupWave(this.wave + 1);
        this.callbacks.onStatsUpdate(this.stats);
      }
    }
  }

  private spawnWaveEnemy() {
    this.enemiesSpawnedInWave++;

    // Pick enemy type according to current wave
    let type: 'slime' | 'skeleton' | 'archer' | 'berserker' = 'slime';
    const rand = Math.random();

    if (this.wave === 1) {
      type = 'slime';
    } else if (this.wave === 2) {
      type = rand < 0.7 ? 'slime' : 'skeleton';
    } else if (this.wave <= 4) {
      type = rand < 0.5 ? 'slime' : rand < 0.85 ? 'skeleton' : 'archer';
    } else if (this.wave <= 7) {
      type = rand < 0.3 ? 'slime' : rand < 0.6 ? 'skeleton' : rand < 0.85 ? 'archer' : 'berserker';
    } else {
      type = rand < 0.25 ? 'skeleton' : rand < 0.55 ? 'archer' : rand < 0.85 ? 'berserker' : 'slime';
    }

    // Spawn at random edge of screen around arena
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    const pad = 40;

    switch (edge) {
      case 0: // top
        x = Math.random() * this.arenaWidth;
        y = pad;
        break;
      case 1: // right
        x = this.arenaWidth - pad;
        y = Math.random() * this.arenaHeight;
        break;
      case 2: // bottom
        x = Math.random() * this.arenaWidth;
        y = this.arenaHeight - pad;
        break;
      case 3: // left
        x = pad;
        y = Math.random() * this.arenaHeight;
        break;
    }

    const enemy = createEnemy(type, x, y, this.wave);
    this.enemies.push(enemy);
  }

  private updateEnemies(dt: number) {
    const now = performance.now() / 1000;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.flashTimer > 0) e.flashTimer -= dt;

      // Distance to player
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;

      // Separation from other enemies (boids flocking force)
      let sepX = 0;
      let sepY = 0;
      for (let j = 0; j < this.enemies.length; j++) {
        if (i === j) continue;
        const other = this.enemies[j];
        const odx = e.x - other.x;
        const ody = e.y - other.y;
        const odist = Math.hypot(odx, ody);
        const minDist = e.radius + other.radius + 4;
        if (odist < minDist && odist > 0) {
          const push = (minDist - odist) / minDist;
          sepX += (odx / odist) * push * 60;
          sepY += (ody / odist) * push * 60;
        }
      }

      // Movement behavior
      const speed = e.speed * 50;
      let targetVx = (dx / dist) * speed;
      let targetVy = (dy / dist) * speed;

      // If ranged enemy, maintain optimal distance
      if (e.isRanged && e.preferredRange) {
        if (dist < e.preferredRange - 40) {
          // Back up
          targetVx = -(dx / dist) * speed * 0.8;
          targetVy = -(dy / dist) * speed * 0.8;
        } else if (dist < e.preferredRange + 40) {
          // Circle or stand ground
          targetVx = (-dy / dist) * speed * 0.5;
          targetVy = (dx / dist) * speed * 0.5;
        }

        // Ranged enemy attack
        if (now - e.lastAttackTime >= e.attackCooldown && dist <= e.preferredRange + 80) {
          e.lastAttackTime = now;
          this.shootEnemyProjectile(e, dx / dist, dy / dist);
        }
      }

      // Friction & steering
      e.vx = e.vx * 0.82 + (targetVx + sepX) * 0.18;
      e.vy = e.vy * 0.82 + (targetVy + sepY) * 0.18;

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // Arena boundaries
      e.x = Math.max(e.radius + 20, Math.min(this.arenaWidth - e.radius - 20, e.x));
      e.y = Math.max(e.radius + 20, Math.min(this.arenaHeight - e.radius - 20, e.y));

      // Melee attack player collision
      if (dist <= e.radius + this.player.radius && !this.player.isInvulnerable) {
        if (now - e.lastAttackTime >= e.attackCooldown) {
          e.lastAttackTime = now;
          this.damagePlayer(e.damage);
        }
      }
    }
  }

  private shootEnemyProjectile(e: Enemy, dirX: number, dirY: number) {
    sound.playShoot(true);
    const speed = 280;

    if (e.type === 'void_lord') {
      // 3-way spread shot
      for (let offset = -0.3; offset <= 0.3; offset += 0.3) {
        const angle = Math.atan2(dirY, dirX) + offset;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: e.x,
          y: e.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 6,
          damage: e.damage,
          isPlayer: false,
          color: '#a855f7',
          distanceTraveled: 0,
          maxDistance: 600,
        });
      }
    } else {
      this.projectiles.push({
        id: this.nextEntityId++,
        x: e.x,
        y: e.y,
        vx: dirX * speed,
        vy: dirY * speed,
        radius: 5,
        damage: e.damage,
        isPlayer: false,
        color: '#f43f5e',
        distanceTraveled: 0,
        maxDistance: 500,
      });
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const step = Math.hypot(p.vx, p.vy) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.distanceTraveled += step;

      // Trail particles
      if (Math.random() < 0.3) {
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          life: 0.15,
          maxLife: 0.15,
          color: p.color,
          size: p.radius * 0.7,
        });
      }

      // Check max distance
      if (p.distanceTraveled >= p.maxDistance) {
        if (p.aoeRadius) {
          this.explodeAoE(p);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check collision
      if (p.isPlayer) {
        let hit = false;
        for (const enemy of this.enemies) {
          const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
          if (dist <= enemy.radius + p.radius) {
            hit = true;
            if (p.aoeRadius) {
              this.explodeAoE(p);
            } else {
              const isCrit = Math.random() < this.stats.critChance;
              const dmg = isCrit ? Math.round(p.damage * this.stats.critMultiplier) : p.damage;
              const dirX = p.vx / (Math.hypot(p.vx, p.vy) || 1);
              const dirY = p.vy / (Math.hypot(p.vx, p.vy) || 1);
              this.damageEnemy(enemy, dmg, isCrit, dirX, dirY, 30);
              sound.playHit(isCrit);
            }
            break;
          }
        }
        if (hit) {
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        // Enemy projectile hits player
        const distToPlayer = Math.hypot(this.player.x - p.x, this.player.y - p.y);
        if (distToPlayer <= this.player.radius + p.radius) {
          if (!this.player.isInvulnerable) {
            this.damagePlayer(p.damage);
          }
          this.projectiles.splice(i, 1);
          continue;
        }
      }
    }
  }

  private explodeAoE(p: Projectile) {
    const aoe = p.aoeRadius || 75;
    sound.playImpact();
    this.triggerCameraShake(6, 0.25);

    this.attackVisuals.push({
      type: 'aoe_burst',
      x: p.x,
      y: p.y,
      angle: 0,
      range: aoe,
      life: 0.25,
      maxLife: 0.25,
      color: p.color,
    });

    for (const enemy of this.enemies) {
      const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (dist <= aoe + enemy.radius) {
        const isCrit = Math.random() < this.stats.critChance;
        const dmg = isCrit ? Math.round(p.damage * this.stats.critMultiplier) : p.damage;
        const kx = (enemy.x - p.x) / (dist || 1);
        const ky = (enemy.y - p.y) / (dist || 1);
        this.damageEnemy(enemy, dmg, isCrit, kx, ky, 50);
      }
    }
  }

  public damagePlayer(rawDamage: number) {
    if (this.player.isInvulnerable) return;

    const heroClass = HERO_CLASSES[this.stats.classId];
    const reducedDamage = Math.max(1, Math.round(rawDamage * heroClass.armor));

    this.stats.hp = Math.max(0, this.stats.hp - reducedDamage);
    this.player.invulnerableTimer = 0.4;
    this.player.isInvulnerable = true;

    this.triggerCameraShake(9, 0.3);
    sound.playHit(false);

    this.addFloatingText(this.player.x, this.player.y - 30, `-${reducedDamage}`, '#ef4444', 1.2);
    this.callbacks.onStatsUpdate(this.stats);

    if (this.stats.hp <= 0) {
      sound.playGameOver();
      this.pause();
      this.callbacks.onGameOver(this.stats);
    }
  }

  private updateDrops(dt: number) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const item = this.drops[i];
      const dx = this.player.x - item.x;
      const dy = this.player.y - item.y;
      const dist = Math.hypot(dx, dy);

      // Attracted if inside pickup radius
      if (dist <= this.player.pickupRadius) {
        const speed = Math.max(220, (1 - dist / this.player.pickupRadius) * 550);
        item.x += (dx / dist) * speed * dt;
        item.y += (dy / dist) * speed * dt;
      }

      // Collected
      if (dist <= this.player.radius + item.radius) {
        if (item.type === 'xp') {
          sound.playCollect(false);
          this.addXp(item.value);
        } else if (item.type === 'gold') {
          sound.playCollect(true);
          this.stats.gold += item.value;
          this.addFloatingText(this.player.x + (Math.random() - 0.5) * 16, this.player.y - 20, `+${item.value} 🪙`, '#fbbf24', 0.85);
          this.callbacks.onStatsUpdate(this.stats);
        } else if (item.type === 'heal') {
          sound.playCollect(false);
          this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + item.value);
          this.addFloatingText(this.player.x, this.player.y - 25, `+${item.value} HP`, '#22c55e', 1.0);
          this.callbacks.onStatsUpdate(this.stats);
        }
        this.drops.splice(i, 1);
      }
    }
  }

  public addXp(amount: number) {
    this.stats.xp += amount;
    this.callbacks.onStatsUpdate(this.stats);

    if (this.stats.xp >= this.stats.xpToNextLevel) {
      this.stats.xp -= this.stats.xpToNextLevel;
      this.stats.level++;
      this.stats.xpToNextLevel = Math.round(45 + (this.stats.level - 1) * 35);
      sound.playLevelUp();
      this.pause();
      this.callbacks.onLevelUp(this.stats);
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }

  private updateFloatingTexts(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
    }
  }

  private updateAttackVisuals(dt: number) {
    for (let i = this.attackVisuals.length - 1; i >= 0; i--) {
      const v = this.attackVisuals[i];
      v.life -= dt;
      if (v.life <= 0) {
        this.attackVisuals.splice(i, 1);
      }
    }
  }

  private updateCamera() {
    const rect = this.canvas.getBoundingClientRect();
    let targetX = this.player.x - rect.width / 2;
    let targetY = this.player.y - rect.height / 2;

    // Apply screen shake
    if (this.shakeTimer > 0) {
      targetX += (Math.random() - 0.5) * this.shakeIntensity * 2;
      targetY += (Math.random() - 0.5) * this.shakeIntensity * 2;
    }

    // Clamp camera within arena
    this.camera.x = Math.max(0, Math.min(this.arenaWidth - rect.width, targetX));
    this.camera.y = Math.max(0, Math.min(this.arenaHeight - rect.height, targetY));
  }

  public triggerCameraShake(intensity: number, duration: number) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  public addFloatingText(x: number, y: number, text: string, color: string, scale: number = 1.0, isCrit: boolean = false) {
    this.floatingTexts.push({
      id: this.nextEntityId++,
      text,
      x,
      y,
      vy: -40,
      life: 0.65,
      maxLife: 0.65,
      color,
      scale,
      isCrit,
    });
  }

  private getNearestEnemy(maxRange: number): Enemy | null {
    let closest: Enemy | null = null;
    let closestDist = maxRange;

    for (const enemy of this.enemies) {
      const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (dist <= closestDist + enemy.radius) {
        closestDist = dist;
        closest = enemy;
      }
    }
    return closest;
  }

  // ================= RENDER PIPELINE =================
  private render() {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Arena Background
    this.renderArena();

    // 2. Drops
    this.renderDrops();

    // 3. Attack Range Visualizer (CRITICAL MECHANIC)
    this.renderAttackRangeZone();

    // 4. Attack Effects Visuals
    this.renderAttackVisuals();

    // 5. Enemies
    this.renderEnemies();

    // 6. Projectiles
    this.renderProjectiles();

    // 7. Player
    this.renderPlayer();

    // 8. Particles
    this.renderParticles();

    // 9. Floating Texts
    this.renderFloatingTexts();

    ctx.restore();
  }

  private renderArena() {
    const ctx = this.ctx;

    // Floor base
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);

    // Grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const cellSize = 60;
    for (let x = 0; x <= this.arenaWidth; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.arenaHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= this.arenaHeight; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.arenaWidth, y);
      ctx.stroke();
    }

    // Arena Outer Border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, this.arenaWidth - 10, this.arenaHeight - 10);

    // Inner glowing ring in center of arena
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.arenaWidth / 2, this.arenaHeight / 2, 260, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * CRITICAL MECHANIC VISUALIZATION:
   * Visualizes the exact attack range and sector of the weapon currently equipped.
   */
  private renderAttackRangeZone() {
    const ctx = this.ctx;
    const px = this.player.x;
    const py = this.player.y;
    const range = this.getEffectiveRange();
    const weapon = this.stats.weapon;

    ctx.save();

    // Pulse effect
    const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.02;
    const currentR = range * pulse;

    if (weapon.type === 'circle' || weapon.type === 'projectile' || weapon.type === 'aoe_burst') {
      // Full circle attack zone
      const gradient = ctx.createRadialGradient(px, py, currentR * 0.3, px, py, currentR);
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.005)');
      gradient.addColorStop(0.85, 'rgba(56, 189, 248, 0.03)');
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0.12)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, currentR, 0, Math.PI * 2);
      ctx.fill();

      // Outer dashed glowing perimeter line
      ctx.strokeStyle = weapon.color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(px, py, currentR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (weapon.type === 'arc' || weapon.type === 'thrust') {
      // Sector cone zone pointing towards current aim angle
      const spread = weapon.spreadAngle || (weapon.type === 'thrust' ? Math.PI * 0.35 : Math.PI * 0.8);
      const startAngle = this.player.angle - spread / 2;
      const endAngle = this.player.angle + spread / 2;

      // Soft circular boundary for reference
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, currentR, 0, Math.PI * 2);
      ctx.stroke();

      // Sector highlighting
      ctx.fillStyle = weapon.trailColor;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, currentR, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();

      // Sector outer arc border
      ctx.strokeStyle = weapon.color;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, currentR, startAngle, endAngle);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderAttackVisuals() {
    const ctx = this.ctx;

    for (const v of this.attackVisuals) {
      const progress = 1 - v.life / v.maxLife; // 0 to 1
      ctx.save();

      if (v.type === 'arc') {
        const spread = v.spreadAngle || Math.PI * 0.8;
        const currentAngle = v.angle - spread / 2 + spread * progress;
        const r = v.range;

        // Glowing sweep slash
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 4 * (1 - progress);
        ctx.shadowColor = v.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(v.x, v.y, r, v.angle - spread / 2, currentAngle);
        ctx.stroke();
      } else if (v.type === 'thrust') {
        // Spear piercing line
        const spearLength = v.range * Math.min(1, progress * 2.5);
        const endX = v.x + Math.cos(v.angle) * spearLength;
        const endY = v.y + Math.sin(v.angle) * spearLength;

        ctx.strokeStyle = v.color;
        ctx.lineWidth = 6 * (1 - progress);
        ctx.shadowColor = v.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Spearhead diamond
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(endX, endY, 5 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      } else if (v.type === 'circle' || v.type === 'aoe_burst') {
        // Expanding shockwave ripple
        const currentR = v.range * progress;
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 5 * (1 - progress);
        ctx.shadowColor = v.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(v.x, v.y, currentR, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    const heroClass = HERO_CLASSES[this.stats.classId];

    ctx.save();
    ctx.translate(p.x, p.y);

    // Invulnerability flashing
    if (p.isInvulnerable && Math.floor(performance.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Cooldown Arc Ring around player (shows weapon attack reload)
    const effectiveCooldown = this.stats.weapon.baseCooldown * (1 - this.stats.cooldownReduction);
    const cdProgress = Math.max(0, 1 - p.attackCooldownTimer / effectiveCooldown);
    ctx.strokeStyle = cdProgress >= 1 ? '#22c55e' : 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cdProgress);
    ctx.stroke();

    // Dash indicator ring
    if (p.dashCooldownTimer > 0) {
      const dashProgress = 1 - p.dashCooldownTimer / p.dashCooldownMax;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dashProgress);
      ctx.stroke();
    }

    // Body circle
    ctx.fillStyle = heroClass.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner accent core
    ctx.fillStyle = heroClass.accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Aim Pointer line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(p.angle) * (p.radius + 8), Math.sin(p.angle) * (p.radius + 8));
    ctx.stroke();

    ctx.restore();

    // Health Bar above player
    const barW = 44;
    const barH = 5;
    const hpPct = Math.max(0, this.stats.hp / this.stats.maxHp);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(p.x - barW / 2, p.y - p.radius - 18, barW, barH);

    ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(p.x - barW / 2, p.y - p.radius - 18, barW * hpPct, barH);
  }

  private renderEnemies() {
    const ctx = this.ctx;

    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);

      // Flash on hit
      if (e.flashTimer > 0) {
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = e.color;
      }

      // Draw Enemy Body
      if (e.isBoss) {
        // Boss glow
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 18;
      }

      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner details
      ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : e.accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Enemy eyes
      const angleToPlayer = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      const eyeOffset = e.radius * 0.35;
      const eyeX = Math.cos(angleToPlayer) * eyeOffset;
      const eyeY = Math.sin(angleToPlayer) * eyeOffset;

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, Math.max(2, e.radius * 0.2), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Enemy HP Bar
      if (e.hp < e.maxHp || e.isBoss) {
        const barW = e.isBoss ? 80 : 30;
        const barH = e.isBoss ? 6 : 3.5;
        const hpPct = Math.max(0, e.hp / e.maxHp);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(e.x - barW / 2, e.y - e.radius - 12, barW, barH);

        ctx.fillStyle = e.isBoss ? '#a855f7' : '#ef4444';
        ctx.fillRect(e.x - barW / 2, e.y - e.radius - 12, barW * hpPct, barH);
      }
    }
  }

  private renderProjectiles() {
    const ctx = this.ctx;

    for (const p of this.projectiles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderDrops() {
    const ctx = this.ctx;
    const time = performance.now() * 0.005;

    for (const item of this.drops) {
      ctx.save();
      ctx.translate(item.x, item.y + Math.sin(time + item.id) * 3);

      ctx.fillStyle = item.color;
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 6;

      if (item.type === 'xp') {
        // Diamond crystal
        ctx.beginPath();
        ctx.moveTo(0, -item.radius);
        ctx.lineTo(item.radius, 0);
        ctx.lineTo(0, item.radius);
        ctx.lineTo(-item.radius, 0);
        ctx.closePath();
        ctx.fill();
      } else if (item.type === 'gold') {
        // Gold Coin
        ctx.beginPath();
        ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, 0, item.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.type === 'heal') {
        // Red Cross
        ctx.fillStyle = '#ef4444';
        const s = item.radius;
        ctx.fillRect(-s / 3, -s, (s * 2) / 3, s * 2);
        ctx.fillRect(-s, -s / 3, s * 2, (s * 2) / 3);
      }

      ctx.restore();
    }
  }

  private renderParticles() {
    const ctx = this.ctx;

    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderFloatingTexts() {
    const ctx = this.ctx;

    for (const ft of this.floatingTexts) {
      const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${ft.isCrit ? 'bold 18px' : 'bold 13px'} "JetBrains Mono", monospace`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}
