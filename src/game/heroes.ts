import { HeroClass, HeroClassId } from './types';

export const HERO_CLASSES: Record<HeroClassId, HeroClass> = {
  knight: {
    id: 'knight',
    name: 'Рыцарь Оплота',
    title: 'Тяжелый страж',
    description: 'Огромный запас здоровья и 25% снижение входящего урона. Отлично держит толпу.',
    baseHp: 260,
    speed: 3.3,
    armor: 0.75, // 25% damage reduction
    critChance: 0.05,
    startingWeaponId: 'sword',
    color: '#e2e8f0',
    accentColor: '#38bdf8',
    iconName: 'Shield',
  },
  blademaster: {
    id: 'blademaster',
    name: 'Мастер Клинка',
    title: 'Сбалансированный воин',
    description: 'Идеальный баланс урона и мобильности. Повышенный базовый шанс критического удара (18%).',
    baseHp: 180,
    speed: 4.0,
    armor: 0.9, // 10% damage reduction
    critChance: 0.18,
    startingWeaponId: 'daggers',
    color: '#38bdf8',
    accentColor: '#818cf8',
    iconName: 'Swords',
  },
  ranger: {
    id: 'ranger',
    name: 'Следопыт-Спринтер',
    title: 'Молниеносный стрелок',
    description: 'Максимальная скорость передвижения и маневренность. Начинает с дальнобойным луком.',
    baseHp: 130,
    speed: 4.8,
    armor: 1.0,
    critChance: 0.12,
    startingWeaponId: 'bow',
    color: '#4ade80',
    accentColor: '#22c55e',
    iconName: 'Footprints',
  },
};
