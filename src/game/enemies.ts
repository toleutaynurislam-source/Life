import { Enemy, EnemyType } from './types';

let nextEnemyId = 1;

export function resetEnemyIdCounter() {
  nextEnemyId = 1;
}

export function createEnemy(type: EnemyType, x: number, y: number, wave: number): Enemy {
  const id = nextEnemyId++;
  const waveScaling = Math.max(1, wave);

  switch (type) {
    case 'slime':
      return {
        id,
        type,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 14,
        hp: 36 + waveScaling * 12,
        maxHp: 36 + waveScaling * 12,
        speed: 2.7 + Math.min(1.2, waveScaling * 0.08),
        damage: 10 + waveScaling * 2,
        xpValue: 12 + waveScaling * 2,
        goldValue: 3 + Math.floor(waveScaling * 0.8),
        color: '#10b981',
        accentColor: '#34d399',
        attackCooldown: 0.6,
        lastAttackTime: 0,
        flashTimer: 0,
      };

    case 'skeleton':
      return {
        id,
        type,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 17,
        hp: 85 + waveScaling * 24,
        maxHp: 85 + waveScaling * 24,
        speed: 2.1 + Math.min(0.9, waveScaling * 0.06),
        damage: 16 + waveScaling * 3,
        xpValue: 24 + waveScaling * 3,
        goldValue: 8 + waveScaling,
        color: '#94a3b8',
        accentColor: '#cbd5e1',
        attackCooldown: 0.8,
        lastAttackTime: 0,
        flashTimer: 0,
      };

    case 'archer':
      return {
        id,
        type,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 15,
        hp: 65 + waveScaling * 18,
        maxHp: 65 + waveScaling * 18,
        speed: 2.2,
        damage: 14 + waveScaling * 2,
        xpValue: 35 + waveScaling * 4,
        goldValue: 12 + waveScaling * 2,
        color: '#ec4899',
        accentColor: '#f472b6',
        isRanged: true,
        preferredRange: 240,
        attackCooldown: 2.2,
        lastAttackTime: 0,
        flashTimer: 0,
      };

    case 'berserker':
      return {
        id,
        type,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 21,
        hp: 170 + waveScaling * 38,
        maxHp: 170 + waveScaling * 38,
        speed: 2.4,
        damage: 25 + waveScaling * 4,
        xpValue: 60 + waveScaling * 6,
        goldValue: 22 + waveScaling * 3,
        color: '#ef4444',
        accentColor: '#f87171',
        attackCooldown: 0.7,
        lastAttackTime: 0,
        flashTimer: 0,
      };

    case 'golem':
      return {
        id,
        type,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 32,
        hp: 750 + waveScaling * 150,
        maxHp: 750 + waveScaling * 150,
        speed: 1.4 + Math.min(0.5, waveScaling * 0.03),
        damage: 38 + waveScaling * 5,
        xpValue: 200 + waveScaling * 25,
        goldValue: 90 + waveScaling * 10,
        color: '#78716c',
        accentColor: '#a8a29e',
        isBoss: true,
        attackCooldown: 1.0,
        lastAttackTime: 0,
        flashTimer: 0,
      };

    case 'void_lord':
      return {
        id,
        type,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 44,
        hp: 2400 + waveScaling * 400,
        maxHp: 2400 + waveScaling * 400,
        speed: 1.6,
        damage: 55 + waveScaling * 6,
        xpValue: 600 + waveScaling * 50,
        goldValue: 300 + waveScaling * 30,
        color: '#7c3aed',
        accentColor: '#c084fc',
        isRanged: true,
        isBoss: true,
        preferredRange: 190,
        attackCooldown: 1.6,
        lastAttackTime: 0,
        flashTimer: 0,
      };
  }
}
