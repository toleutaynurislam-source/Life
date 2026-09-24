/**
 * Types and interfaces for the 2D Arena Survival game.
 */

export type HeroClassId = 'knight' | 'blademaster' | 'ranger';

export interface HeroClass {
  id: HeroClassId;
  name: string;
  title: string;
  description: string;
  baseHp: number;
  speed: number;
  armor: number; // damage reduction multiplier e.g. 0.8 = 20% reduction
  critChance: number;
  startingWeaponId: WeaponId;
  color: string;
  accentColor: string;
  iconName: string;
}

export type WeaponId = 'daggers' | 'sword' | 'spear' | 'bow' | 'staff' | 'hammer';

export type WeaponType = 'arc' | 'circle' | 'thrust' | 'projectile' | 'aoe_burst';

export interface Weapon {
  id: WeaponId;
  name: string;
  description: string;
  type: WeaponType;
  baseRange: number; // Radius in pixels
  baseDamage: number;
  baseCooldown: number; // in seconds
  spreadAngle?: number; // radians for arc/thrust
  knockback: number;
  projectileSpeed?: number;
  aoeRadius?: number;
  price: number;
  color: string;
  trailColor: string;
}

export interface PlayerStats {
  classId: HeroClassId;
  level: number;
  xp: number;
  xpToNextLevel: number;
  gold: number;
  kills: number;
  wave: number;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  damageMultiplier: number;
  rangeMultiplier: number;
  cooldownReduction: number; // 0 to 0.6
  lifeSteal: number; // 0 to 0.3
  critChance: number;
  critMultiplier: number;
  weapon: Weapon;
  weaponLevel: number;
}

export type EnemyType = 'slime' | 'skeleton' | 'archer' | 'berserker' | 'golem' | 'void_lord';

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpValue: number;
  goldValue: number;
  color: string;
  accentColor: string;
  isRanged?: boolean;
  attackCooldown: number;
  lastAttackTime: number;
  preferredRange?: number;
  isBoss?: boolean;
  flashTimer: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isPlayer: boolean;
  color: string;
  distanceTraveled: number;
  maxDistance: number;
  aoeRadius?: number;
}

export interface DropItem {
  id: number;
  type: 'xp' | 'gold' | 'heal';
  x: number;
  y: number;
  value: number;
  radius: number;
  color: string;
  creationTime: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  isCrit?: boolean;
  scale: number;
}

export interface AttackVisual {
  type: WeaponType;
  x: number;
  y: number;
  angle: number;
  range: number;
  spreadAngle?: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface UpgradeOption {
  id: string;
  title: string;
  category: 'range' | 'damage' | 'speed' | 'defense' | 'weapon' | 'special';
  description: string;
  statBonus: string;
  icon: string;
  apply: (stats: PlayerStats) => void;
}
