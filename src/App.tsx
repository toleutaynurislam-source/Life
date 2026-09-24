import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Shield,
  Swords,
  Footprints,
  Volume2,
  VolumeX,
  Store,
  RotateCcw,
  Download,
  Copy,
  Check,
  Pause,
  Play,
  Zap,
  Radio,
  Sparkles,
  Heart,
  Coins,
  Skull,
} from 'lucide-react';
import { GameEngine } from './game/engine';
import { HERO_CLASSES } from './game/heroes';
import { WEAPONS } from './game/weapons';
import { sound } from './game/audio';
import { HeroClassId, PlayerStats, UpgradeOption, WeaponId } from './game/types';
import { getRandomUpgrades } from './game/upgrades';
import { generateStandaloneGameHtml } from './game/standaloneGenerator';

type ScreenState = 'HERO_SELECT' | 'PLAYING' | 'LEVEL_UP' | 'ARMORY' | 'GAME_OVER' | 'VICTORY';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [screen, setScreen] = useState<ScreenState>('HERO_SELECT');
  const [selectedHero, setSelectedHero] = useState<HeroClassId>('knight');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);

  // HUD stats state
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [levelUpOptions, setLevelUpOptions] = useState<UpgradeOption[]>([]);
  const [waveNotification, setWaveNotification] = useState<string | null>(null);

  // Virtual touch controls state
  const joystickRef = useRef<{ active: boolean; startX: number; startY: number; curX: number; curY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
  });
  const [joystickUI, setJoystickUI] = useState<{ visible: boolean; x: number; y: number; dx: number; dy: number }>({
    visible: false,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
  });

  // Handle Level Up
  const handleLevelUp = useCallback((currentStats: PlayerStats) => {
    setStats({ ...currentStats });
    const upgrades = getRandomUpgrades(3) as UpgradeOption[];
    setLevelUpOptions(upgrades);
    setScreen('LEVEL_UP');
  }, []);

  // Handle Game Over
  const handleGameOver = useCallback((currentStats: PlayerStats) => {
    setStats({ ...currentStats });
    setScreen('GAME_OVER');
  }, []);

  // Handle Wave Complete
  const handleWaveComplete = useCallback((waveNum: number) => {
    setWaveNotification(`Волна ${waveNum} пройдена! +${25 + waveNum * 10} Золота`);
    setTimeout(() => {
      setWaveNotification(null);
    }, 3000);
  }, []);

  // Handle Stats Update from Engine
  const handleStatsUpdate = useCallback((currentStats: PlayerStats) => {
    setStats({ ...currentStats });
  }, []);

  // Initialize Game Engine
  const startGame = (heroId: HeroClassId) => {
    if (!canvasRef.current) return;

    sound.initContext?.();

    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }

    const engine = new GameEngine(canvasRef.current, heroId, {
      onLevelUp: handleLevelUp,
      onGameOver: handleGameOver,
      onWaveComplete: handleWaveComplete,
      onStatsUpdate: handleStatsUpdate,
    });

    engineRef.current = engine;
    setStats({ ...engine.stats });
    setScreen('PLAYING');
    setIsPaused(false);
    engine.start();
  };

  // Keyboard Event Listeners for WASD and Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (engineRef.current) {
        engineRef.current.keys[e.code] = true;
        if (e.code === 'Space') {
          e.preventDefault();
          engineRef.current.triggerDash();
        }
        if (e.code === 'KeyP' || e.code === 'Escape') {
          if (screen === 'PLAYING') {
            togglePause();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (engineRef.current) {
        engineRef.current.keys[e.code] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [screen]);

  // Window Resize
  useEffect(() => {
    const handleResize = () => {
      if (engineRef.current) {
        engineRef.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse aim handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    engineRef.current.mousePos.x = screenX;
    engineRef.current.mousePos.y = screenY;
    engineRef.current.mousePos.worldX = screenX + engineRef.current.camera.x;
    engineRef.current.mousePos.worldY = screenY + engineRef.current.camera.y;
  };

  const handleMouseDown = () => {
    if (engineRef.current) {
      engineRef.current.mousePos.isDown = true;
    }
  };

  const handleMouseUp = () => {
    if (engineRef.current) {
      engineRef.current.mousePos.isDown = false;
    }
  };

  // Touch handlers for mobile virtual joystick
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Only start joystick on left half of screen
    if (x < rect.width * 0.6) {
      joystickRef.current = {
        active: true,
        startX: x,
        startY: y,
        curX: x,
        curY: y,
      };
      setJoystickUI({ visible: true, x, y, dx: 0, dy: 0 });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!joystickRef.current.active || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const dx = x - joystickRef.current.startX;
    const dy = y - joystickRef.current.startY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 45;

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const clampedX = Math.cos(angle) * clampedDist;
    const clampedY = Math.sin(angle) * clampedDist;

    setJoystickUI((prev) => ({ ...prev, dx: clampedX, dy: clampedY }));

    if (engineRef.current) {
      engineRef.current.virtualJoystick.active = true;
      engineRef.current.virtualJoystick.dx = clampedX / maxRadius;
      engineRef.current.virtualJoystick.dy = clampedY / maxRadius;
    }
  };

  const handleTouchEnd = () => {
    joystickRef.current.active = false;
    setJoystickUI((prev) => ({ ...prev, visible: false, dx: 0, dy: 0 }));
    if (engineRef.current) {
      engineRef.current.virtualJoystick.active = false;
      engineRef.current.virtualJoystick.dx = 0;
      engineRef.current.virtualJoystick.dy = 0;
    }
  };

  // Sound Toggle
  const toggleSound = () => {
    const nextState = sound.toggleMute();
    setSoundEnabled(nextState);
  };

  // Pause / Resume
  const togglePause = () => {
    if (!engineRef.current) return;
    if (isPaused) {
      engineRef.current.resume();
      setIsPaused(false);
    } else {
      engineRef.current.pause();
      setIsPaused(true);
    }
  };

  // Select Level Up Upgrade
  const chooseUpgrade = (upgrade: UpgradeOption) => {
    if (!engineRef.current) return;
    upgrade.apply(engineRef.current.stats);
    setStats({ ...engineRef.current.stats });
    setScreen('PLAYING');
    engineRef.current.resume();
  };

  // Buy or Equip Weapon
  const handleWeaponPurchase = (weaponId: WeaponId) => {
    if (!engineRef.current) return;
    const w = WEAPONS[weaponId];
    if (!w) return;

    if (engineRef.current.stats.weapon.id === weaponId) {
      return; // already equipped
    }

    if (engineRef.current.stats.gold >= w.price) {
      engineRef.current.stats.gold -= w.price;
      engineRef.current.switchWeapon(weaponId);
      setStats({ ...engineRef.current.stats });
    }
  };

  // Download Standalone .html
  const downloadStandaloneHtml = () => {
    const html = generateStandaloneGameHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'arena_of_ranges_survival.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy HTML source to clipboard
  const copyStandaloneHtml = async () => {
    try {
      const html = generateStandaloneGameHtml();
      await navigator.clipboard.writeText(html);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2500);
    } catch {
      // fallback
    }
  };

  // Effective attack stats
  const effectiveRange = stats ? Math.round(stats.weapon.baseRange * stats.rangeMultiplier) : 0;
  const effectiveCooldown = stats
    ? (stats.weapon.baseCooldown * (1 - stats.cooldownReduction)).toFixed(2)
    : '0';
  const effectiveDamage = stats ? Math.round(stats.weapon.baseDamage * stats.damageMultiplier) : 0;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. Main Game Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />

      {/* 2. Top Bar Navigation & Stats Contract */}
      {screen === 'PLAYING' && stats && (
        <header className="absolute top-0 left-0 right-0 z-30 px-4 py-2.5 flex items-center justify-between pointer-events-none bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent">
          {/* Zone 1: Single text wordmark */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <span className="font-display font-bold text-base tracking-wider text-slate-100 uppercase">
              Arena of Ranges
            </span>
            <span className="text-xs text-amber-400 font-mono-nums font-semibold px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
              ВОЛНА {stats.wave}
            </span>
          </div>

          {/* Zone 2: Character Status Meters (Zero-Pill, Typographic) */}
          <div className="pointer-events-auto hidden md:flex items-center gap-6 bg-slate-900/85 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 shadow-xl">
            {/* HP Bar */}
            <div className="flex flex-col gap-1 min-w-[130px]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-rose-500" /> HP
                </span>
                <span className="font-mono-nums font-semibold text-slate-200">
                  {Math.max(0, stats.hp)} / {stats.maxHp}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-150"
                  style={{ width: `${Math.max(0, (stats.hp / stats.maxHp) * 100)}%` }}
                />
              </div>
            </div>

            {/* XP Bar & Level */}
            <div className="flex flex-col gap-1 min-w-[130px]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" /> УР. {stats.level}
                </span>
                <span className="font-mono-nums text-slate-300">
                  {stats.xp} / {stats.xpToNextLevel} XP
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-150"
                  style={{ width: `${Math.min(100, (stats.xp / stats.xpToNextLevel) * 100)}%` }}
                />
              </div>
            </div>

            {/* Currency & Kills */}
            <div className="flex items-center gap-4 text-xs font-mono-nums text-slate-300 border-l border-slate-800 pl-4">
              <span className="flex items-center gap-1 font-semibold text-amber-400">
                <Coins className="w-3.5 h-3.5" /> {stats.gold}
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <Skull className="w-3.5 h-3.5 text-slate-500" /> {stats.kills}
              </span>
            </div>

            {/* Current Weapon Range Display (CRITICAL MECHANIC INDICATOR) */}
            <div className="flex items-center gap-2 border-l border-slate-800 pl-4 text-xs">
              <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-slate-400 text-[10px]">РАДИУС АТАКИ</span>
                <span className="font-mono-nums font-bold text-sky-300">{effectiveRange} px</span>
              </div>
            </div>
          </div>

          {/* Zone 3: Primary Action Controls */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => {
                if (engineRef.current) engineRef.current.pause();
                setScreen('ARMORY');
              }}
              className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-700/50 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              title="Открыть лавку оружия"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Оружейная</span>
            </button>

            <button
              onClick={toggleSound}
              className="p-2 text-slate-400 hover:text-slate-100 bg-slate-900/80 border border-slate-800 rounded-lg transition-colors"
              title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
            </button>

            <button
              onClick={togglePause}
              className="p-2 text-slate-400 hover:text-slate-100 bg-slate-900/80 border border-slate-800 rounded-lg transition-colors"
              title={isPaused ? 'Продолжить' : 'Пауза'}
            >
              {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4" />}
            </button>

            <button
              onClick={downloadStandaloneHtml}
              className="hidden lg:flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
              title="Скачать игру в одном HTML-файле"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.HTML</span>
            </button>
          </div>
        </header>
      )}

      {/* Wave Notification Banner */}
      {waveNotification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-300 animate-bounce">
          <div className="bg-amber-500/90 text-slate-950 px-5 py-2 rounded-full font-bold text-sm shadow-2xl tracking-wide flex items-center gap-2 border border-amber-300">
            <Sparkles className="w-4 h-4" />
            {waveNotification}
          </div>
        </div>
      )}

      {/* On-screen Virtual Touch Joystick for mobile */}
      {joystickUI.visible && (
        <div
          className="absolute z-20 pointer-events-none rounded-full border-2 border-sky-400/40 bg-sky-950/30 backdrop-blur-xs flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${joystickUI.x}px`,
            top: `${joystickUI.y}px`,
            width: '90px',
            height: '90px',
          }}
        >
          <div
            className="w-10 h-10 rounded-full bg-sky-400/80 shadow-lg"
            style={{
              transform: `translate(${joystickUI.dx}px, ${joystickUI.dy}px)`,
            }}
          />
        </div>
      )}

      {/* Mobile Dash Button */}
      {screen === 'PLAYING' && (
        <button
          onClick={() => engineRef.current?.triggerDash()}
          className="md:hidden absolute bottom-6 right-6 z-30 w-16 h-16 rounded-full bg-sky-600 active:bg-sky-700 text-white shadow-2xl flex flex-col items-center justify-center border-2 border-sky-400 font-bold text-xs"
        >
          <Zap className="w-5 h-5" />
          РЫВОК
        </button>
      )}

      {/* 3. SCREEN: Hero Select Modal */}
      {screen === 'HERO_SELECT' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col">
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-100 mb-2">
                ARENA OF RANGES
              </h1>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                Аркадное выживание героя против волн AI-врагов. Управляйте дистанцией боя, расширяйте радиус поражения оружия и отражайте нападения боссов!
              </p>
            </div>

            {/* Hero Class Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {(Object.keys(HERO_CLASSES) as HeroClassId[]).map((id) => {
                const hero = HERO_CLASSES[id];
                const isSelected = selectedHero === id;
                const startWeapon = WEAPONS[hero.startingWeaponId];

                return (
                  <div
                    key={id}
                    onClick={() => setSelectedHero(id)}
                    className={`cursor-pointer rounded-xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-400 shadow-lg shadow-sky-500/10 -translate-y-1'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${hero.color}20`, color: hero.color }}
                        >
                          {id === 'knight' && <Shield className="w-5 h-5" />}
                          {id === 'blademaster' && <Swords className="w-5 h-5" />}
                          {id === 'ranger' && <Footprints className="w-5 h-5" />}
                        </div>
                        <span className="text-[11px] font-mono-nums text-slate-400 font-semibold">
                          {hero.title}
                        </span>
                      </div>

                      <h3 className="font-semibold text-lg text-slate-100 mb-1">{hero.name}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">{hero.description}</p>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-800/80 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Здоровье (HP)</span>
                        <span className="font-mono-nums font-semibold text-slate-200">{hero.baseHp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Скорость бега</span>
                        <span className="font-mono-nums font-semibold text-slate-200">{hero.speed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Стартовое оружие</span>
                        <span className="font-semibold" style={{ color: startWeapon.color }}>
                          {startWeapon.name}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Радиус оружия</span>
                        <span className="font-mono-nums">{startWeapon.baseRange} px</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Start Button & Controls Hint */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-400 leading-normal text-center sm:text-left">
                <div>
                  Управление: <span className="text-slate-200 font-medium">WASD / Стрелки</span> — бег,{' '}
                  <span className="text-slate-200 font-medium">Пробел / Shift</span> — рывок уклонения
                </div>
                <div className="text-slate-500">
                  Атака срабатывает <span className="text-sky-300">автоматически</span> при входе врага в радиус оружия!
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={downloadStandaloneHtml}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center justify-center gap-2"
                  title="Скачать одиночный файл .html"
                >
                  <Download className="w-4 h-4" />
                  Скачать .html
                </button>

                <button
                  onClick={() => startGame(selectedHero)}
                  className="w-full sm:w-auto px-7 py-2.5 font-semibold text-sm text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-xl transition-all shadow-lg shadow-sky-400/20 active:scale-95 whitespace-nowrap"
                >
                  Вступить в бой
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SCREEN: Level Up 3-Card Modal */}
      {screen === 'LEVEL_UP' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              ПОВЫШЕНИЕ УРОВНЯ · УРОВЕНЬ {stats?.level}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-100 mb-2">
              Выберите улучшение
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-6">
              Усильте боевые характеристики героя или расширьте радиус поражения оружия:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
              {levelUpOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => chooseUpgrade(opt)}
                  className="group text-left p-4 rounded-xl bg-slate-850 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-400/80 transition-all duration-150 flex flex-col justify-between shadow-md hover:-translate-y-1"
                >
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-3 group-hover:bg-sky-400 group-hover:text-slate-950 transition-colors">
                      {opt.category === 'range' && <Radio className="w-4 h-4" />}
                      {opt.category === 'damage' && <Swords className="w-4 h-4" />}
                      {opt.category === 'speed' && <Zap className="w-4 h-4" />}
                      {opt.category === 'defense' && <Shield className="w-4 h-4" />}
                      {opt.category === 'special' && <Heart className="w-4 h-4" />}
                    </div>
                    <h4 className="font-semibold text-sm text-slate-100 mb-1.5 group-hover:text-sky-300">
                      {opt.title}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">{opt.description}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-xs font-mono-nums font-bold text-sky-400">
                    {opt.statBonus}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. SCREEN: Armory / Weapon Shop */}
      {screen === 'ARMORY' && stats && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <Store className="w-5 h-5 text-amber-400" /> Оружейная Лавка
                </h2>
                <p className="text-xs text-slate-400">
                  Покупайте и экипируйте оружие с разной дальностью, типом атаки и уроном
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono-nums font-bold text-sm">
                <Coins className="w-4 h-4" /> {stats.gold} 🪙
              </div>
            </div>

            {/* Weapon Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto pr-1 flex-1 py-1">
              {(Object.keys(WEAPONS) as WeaponId[]).map((wId) => {
                const w = WEAPONS[wId];
                const isEquipped = stats.weapon.id === wId;
                const canAfford = stats.gold >= w.price;

                return (
                  <div
                    key={wId}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      isEquipped
                        ? 'bg-slate-850 border-sky-400 shadow-md shadow-sky-500/10'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded border"
                          style={{
                            color: w.color,
                            backgroundColor: `${w.color}15`,
                            borderColor: `${w.color}40`,
                          }}
                        >
                          {w.type === 'arc' && 'Взмах (Сектор)'}
                          {w.type === 'thrust' && 'Выпад (Пронзание)'}
                          {w.type === 'projectile' && 'Дальний бой'}
                          {w.type === 'aoe_burst' && 'Магический взрыв'}
                          {w.type === 'circle' && 'Круговой AoE 360°'}
                        </span>
                        {isEquipped && (
                          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                            В руках
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-sm text-slate-100 mb-1" style={{ color: w.color }}>
                        {w.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{w.description}</p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px] mb-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Базовый радиус:</span>
                        <span className="font-mono-nums text-slate-300 font-semibold">{w.baseRange} px</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Базовый урон:</span>
                        <span className="font-mono-nums text-slate-300 font-semibold">{w.baseDamage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Кулдаун атаки:</span>
                        <span className="font-mono-nums text-slate-300 font-semibold">{w.baseCooldown} с</span>
                      </div>
                    </div>

                    <button
                      disabled={isEquipped || !canAfford}
                      onClick={() => handleWeaponPurchase(wId)}
                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                        isEquipped
                          ? 'bg-slate-800 text-slate-400 cursor-default'
                          : canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isEquipped ? 'Экипировано' : canAfford ? `Купить за ${w.price} 🪙` : `${w.price} 🪙 (Не хватает)`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setScreen('PLAYING');
                  if (engineRef.current) engineRef.current.resume();
                }}
                className="px-6 py-2 bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs rounded-xl transition-all"
              >
                Вернуться в бой
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SCREEN: Game Over Screen */}
      {screen === 'GAME_OVER' && stats && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <Skull className="w-6 h-6" />
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold text-rose-400 mb-1">
              ГЕРОЙ ПАЛ В БОЮ
            </h2>
            <p className="text-xs text-slate-400 mb-6">Волны AI-врагов сломили вашу оборону</p>

            {/* Run summary stats */}
            <div className="bg-slate-850 rounded-xl p-4 border border-slate-800 space-y-2.5 text-xs text-slate-300 font-mono-nums mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">Достигнутая волна:</span>
                <span className="font-bold text-amber-400">{stats.wave}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Уничтожено врагов:</span>
                <span className="font-bold text-slate-200">{stats.kills}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Собрано золота:</span>
                <span className="font-bold text-amber-300">{stats.gold} 🪙</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Достигнутый уровень:</span>
                <span className="font-bold text-sky-400">{stats.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Итоговый радиус атаки:</span>
                <span className="font-bold text-sky-300">{effectiveRange} px</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setScreen('HERO_SELECT')}
                className="w-full py-2.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Выбрать героя и играть снова
              </button>

              <div className="flex gap-2">
                <button
                  onClick={downloadStandaloneHtml}
                  className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Скачать .html
                </button>
                <button
                  onClick={copyStandaloneHtml}
                  className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  {copiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedHtml ? 'Скопировано!' : 'Копировать код'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. PAUSE OVERLAY */}
      {isPaused && screen === 'PLAYING' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center max-w-xs w-full">
            <h3 className="font-display text-xl font-bold text-slate-100 mb-2">ИГРА НА ПАУЗЕ</h3>
            <p className="text-xs text-slate-400 mb-5">Нажмите продолжить для возвращения в сражение</p>
            <div className="space-y-2">
              <button
                onClick={togglePause}
                className="w-full py-2 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs rounded-lg transition-all"
              >
                Продолжить
              </button>
              <button
                onClick={downloadStandaloneHtml}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Скачать автономный .html
              </button>
              <button
                onClick={() => {
                  engineRef.current?.stop();
                  setScreen('HERO_SELECT');
                }}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-rose-400 text-xs rounded-lg transition-all"
              >
                Выйти в меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
