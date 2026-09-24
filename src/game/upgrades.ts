import { UpgradeOption, PlayerStats } from './types';

export const ALL_UPGRADES: Omit<UpgradeOption, 'apply'>[] = [
  {
    id: 'range_up',
    title: 'Расширение Зоны Поражения',
    category: 'range',
    description: 'Увеличивает радиус поражения любого оружия на 20%. Позволяет поражать врагов на более безопасной дистанции.',
    statBonus: '+20% Радиус атаки',
    icon: 'Radio',
  },
  {
    id: 'damage_up',
    title: 'Заточка и Усиление',
    category: 'damage',
    description: 'Повышает базовый урон всех ударов и снарядов на 22%.',
    statBonus: '+22% Урон',
    icon: 'Sword',
  },
  {
    id: 'attack_speed_up',
    title: 'Молниеносный Ритм',
    category: 'speed',
    description: 'Снижает время перезарядки между атаками на 15%. Автоатака срабатывает чаще.',
    statBonus: '+15% Скорость атаки',
    icon: 'Zap',
  },
  {
    id: 'move_speed_up',
    title: 'Сапоги Ветра',
    category: 'speed',
    description: 'Увеличивает скорость перемещения героя на 14% для легкого маневрирования между волнами.',
    statBonus: '+14% Скорость бега',
    icon: 'Wind',
  },
  {
    id: 'lifesteal_up',
    title: 'Жажда Битвы',
    category: 'special',
    description: 'Восстанавливает здоровье в размере 5% от нанесенного урона при каждом успешном ударе.',
    statBonus: '+5% Вампиризм',
    icon: 'HeartHandshake',
  },
  {
    id: 'crit_chance_up',
    title: 'Прицельный Удар',
    category: 'damage',
    description: 'Повышает вероятность нанесения критического урона на 10%.',
    statBonus: '+10% Крит шанс',
    icon: 'Target',
  },
  {
    id: 'health_up',
    title: 'Броня Титана',
    category: 'defense',
    description: 'Увеличивает максимальный запас здоровья на 45 единиц и мгновенно восстанавливает 60 HP.',
    statBonus: '+45 Макс HP (+60 отхил)',
    icon: 'ShieldPlus',
  },
  {
    id: 'crit_mult_up',
    title: 'Сокрушительный Разрушитель',
    category: 'damage',
    description: 'Увеличивает множитель критического урона с 2.0x до 2.5x.',
    statBonus: '+50% Крит урон',
    icon: 'Sparkles',
  },
];

export function applyUpgrade(upgradeId: string, stats: PlayerStats): void {
  switch (upgradeId) {
    case 'range_up':
      stats.rangeMultiplier += 0.20;
      break;
    case 'damage_up':
      stats.damageMultiplier += 0.22;
      break;
    case 'attack_speed_up':
      // Reduce cooldown up to cap of 60%
      stats.cooldownReduction = Math.min(0.60, stats.cooldownReduction + 0.15);
      break;
    case 'move_speed_up':
      stats.moveSpeed = +(stats.moveSpeed * 1.14).toFixed(2);
      break;
    case 'lifesteal_up':
      stats.lifeSteal = Math.min(0.25, stats.lifeSteal + 0.05);
      break;
    case 'crit_chance_up':
      stats.critChance = Math.min(0.75, stats.critChance + 0.10);
      break;
    case 'health_up':
      stats.maxHp += 45;
      stats.hp = Math.min(stats.maxHp, stats.hp + 60);
      break;
    case 'crit_mult_up':
      stats.critMultiplier += 0.50;
      break;
  }
}

export function getRandomUpgrades(count: number = 3): (Omit<UpgradeOption, 'apply'> & { apply: (s: PlayerStats) => void })[] {
  const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((item) => ({
    ...item,
    apply: (s: PlayerStats) => applyUpgrade(item.id, s),
  }));
}
