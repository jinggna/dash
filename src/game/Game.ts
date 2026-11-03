import { GameState, GameStats, ObstacleType } from './types';
import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  LANE_Y,
  TOTAL_GAME_TIME,
  FEVER_DURATION,
  NEAR_MISS_POINTS,
  CRASH_POINTS,
  SMASH_POINTS,
  NEAR_MISS_NITRO_GAIN,
  NORMAL_ROAD_SPEED,
  FEVER_ROAD_SPEED,
  MIN_OBSTACLE_SPACING_X,
} from './constants';
import { checkAABBOverlap, checkPolygonIntersection } from './collision';
import { Background } from './entities/Background';
import { PlayerCar } from './entities/PlayerCar';
import { Obstacle } from './entities/Obstacle';
import { ParticleSystem } from './entities/Particle';
import { FloatingTextManager } from './entities/FloatingText';
import { soundEngine } from './audio';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  public state: GameState = 'READY';
  private lastTime: number = 0;
  private animFrameId: number | null = null;

  // Entities
  public background: Background;
  public player: PlayerCar;
  public obstacles: Obstacle[] = [];
  public particles: ParticleSystem;
  public floatingTexts: FloatingTextManager;

  // Game Stats
  public score: number = 0;
  public timeRemaining: number = TOTAL_GAME_TIME;
  public nitro: number = 0; // 0 to 100
  public isFever: boolean = false;
  public feverTimer: number = 0;
  public combo: number = 0;
  public maxCombo: number = 0;
  public nearMissCount: number = 0;
  public crashCount: number = 0;
  public smashCount: number = 0;
  public highScore: number = 0;

  // Spawning
  private spawnTimer: number = 0;
  private lastSpawnedLane: number = 0;
  private lastTickSecond: number = 6;

  // Callbacks
  private onStatsChange?: (stats: GameStats) => void;
  private onStateChange?: (state: GameState) => void;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks?: {
      onStatsChange?: (stats: GameStats) => void;
      onStateChange?: (state: GameState) => void;
    }
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;

    this.onStatsChange = callbacks?.onStatsChange;
    this.onStateChange = callbacks?.onStateChange;

    this.background = new Background();
    this.player = new PlayerCar();
    this.particles = new ParticleSystem();
    this.floatingTexts = new FloatingTextManager();

    // Load Highscore
    const saved = localStorage.getItem('nitro_dash_highscore');
    if (saved) {
      this.highScore = parseInt(saved, 10) || 0;
    }

    this.setupListeners();
    this.render(); // initial frame
  }

  private setupListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    soundEngine.stopEngine();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.state === 'PLAYING') {
        this.pause();
      } else if (this.state === 'PAUSED') {
        this.resume();
      } else if (this.state === 'READY' || this.state === 'GAMEOVER') {
        this.start();
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      this.switchLane('UP');
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      this.switchLane('DOWN');
    }
  };

  public switchLane(direction: 'UP' | 'DOWN') {
    if (this.state !== 'PLAYING') return;
    const switched = this.player.switchLane(direction);
    if (switched) {
      soundEngine.playLaneSwitch();
      // Emit exhaust swoosh
      this.particles.emitExhaustFlame(this.player.x - 45, this.player.y, this.isFever);
    }
  }

  public start() {
    this.state = 'PLAYING';
    this.timeRemaining = TOTAL_GAME_TIME;
    this.score = 0;
    this.nitro = 0;
    this.isFever = false;
    this.feverTimer = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.nearMissCount = 0;
    this.crashCount = 0;
    this.smashCount = 0;
    this.spawnTimer = 0.5; // first obstacle comes after 0.5s
    this.obstacles = [];
    this.lastTickSecond = 6;

    this.player.reset();
    soundEngine.startEngine();

    if (this.onStateChange) this.onStateChange(this.state);
    this.emitStats();

    this.lastTime = performance.now();
    if (this.animFrameId === null) {
      this.loop(this.lastTime);
    }
  }

  public pause() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    soundEngine.stopEngine();
    if (this.onStateChange) this.onStateChange(this.state);
    this.emitStats();
  }

  public resume() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    soundEngine.startEngine();
    if (this.onStateChange) this.onStateChange(this.state);
    this.emitStats();
    this.lastTime = performance.now();
  }

  public restart() {
    this.start();
  }

  private loop = (timestamp: number) => {
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Clamp dt to avoid physics exploding after tab suspension
    if (dt > 0.08) dt = 0.08;

    if (this.state === 'PLAYING') {
      this.update(dt);
    }

    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    // 1. Time Countdown
    this.timeRemaining -= dt;

    // Urgent tick sound on last 5 seconds
    if (this.timeRemaining <= 5.0 && this.timeRemaining > 0) {
      const curSec = Math.ceil(this.timeRemaining);
      if (curSec < this.lastTickSecond) {
        soundEngine.playTick();
        this.lastTickSecond = curSec;
      }
    }

    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.gameOver();
      return;
    }

    // 2. Fever Time Management
    if (this.isFever) {
      this.feverTimer -= dt;
      this.nitro = Math.max(0, (this.feverTimer / FEVER_DURATION) * 100);
      if (this.feverTimer <= 0) {
        this.isFever = false;
        this.feverTimer = 0;
        this.nitro = 0;
      }
    } else {
      // Check for Fever trigger
      if (this.nitro >= 100) {
        this.activateFever();
      }
    }

    // 3. Current Effective Road Speed
    let currentSpeed = NORMAL_ROAD_SPEED;
    if (this.isFever) {
      currentSpeed = FEVER_ROAD_SPEED;
    } else if (this.player.isStunned) {
      // Stopped during stun
      currentSpeed = 0;
    }

    // Update sound engine pitch
    soundEngine.updateEnginePitch(currentSpeed / NORMAL_ROAD_SPEED, this.isFever);

    // 4. Update Entities
    this.background.update(dt, currentSpeed);
    this.player.update(dt, this.isFever);
    this.particles.update(dt);
    this.floatingTexts.update(dt);

    // Exhaust emissions while driving
    if (currentSpeed > 0 && Math.random() < 0.6) {
      this.particles.emitExhaustFlame(this.player.x - 48, this.player.y + 4, this.isFever);
    }

    // 5. Spawning Logic
    this.updateSpawning(dt);

    // 6. Update Obstacles & Collision
    this.updateObstacles(dt, currentSpeed);

    // 7. Emit UI stats update periodically
    this.emitStats();
  }

  private activateFever() {
    this.isFever = true;
    this.feverTimer = FEVER_DURATION;
    this.nitro = 100;
    soundEngine.playFeverStart();
    this.particles.triggerFlash('#FFE600', 0.65);
    this.particles.triggerShake(12);
    this.floatingTexts.add('FEVER TIME!', this.player.x + 80, this.player.y - 45, '#FFE600', '무적 질주 + 속도 2배!', '#FF007F');
  }

  private updateSpawning(dt: number) {
    this.spawnTimer -= dt;

    if (this.spawnTimer <= 0) {
      // Level design formula:
      // Elapsed time: 0 to 40
      const elapsed = TOTAL_GAME_TIME - this.timeRemaining;

      // 0~10s: Interval ~2.2s -> 1.7s
      // 10~40s: Interval scales from 1.7s down to ~0.75s
      let interval: number;
      if (elapsed < 10) {
        interval = 2.2 - (elapsed / 10) * 0.5; // 2.2 -> 1.7
      } else {
        const progress = (elapsed - 10) / 30; // 0 to 1
        interval = 1.7 - progress * 0.95; // 1.7 -> 0.75
      }

      this.spawnTimer = interval;
      this.spawnObstacle();
    }
  }

  private spawnObstacle() {
    // Determine lane:
    // Alternate or pick lane while strictly guaranteeing no unavoidable overlap
    const laneChoices = [0, 1];
    let chosenLane = Math.random() > 0.5 ? 0 : 1;

    // Check existing obstacles to prevent unavoidable wall
    // "장애물 간 최소 X축 생성 거리(450px)를 보장하세요."
    const spawnX = VIRTUAL_WIDTH + 80;

    // Check if there is an obstacle too close in the opposite lane
    const otherLane = chosenLane === 0 ? 1 : 0;
    const tooCloseOpposite = this.obstacles.some(
      (ob) => ob.lane === otherLane && Math.abs(ob.x - spawnX) < MIN_OBSTACLE_SPACING_X
    );

    if (tooCloseOpposite) {
      // If opposite lane has an obstacle within 450px, check if our current lane has room
      const tooCloseSame = this.obstacles.some(
        (ob) => ob.lane === chosenLane && Math.abs(ob.x - spawnX) < MIN_OBSTACLE_SPACING_X * 0.7
      );
      if (tooCloseSame) {
        // Delay spawn until road has cleared enough space
        this.spawnTimer = 0.35;
        return;
      }
    }

    // Pick obstacle type with variety
    const types: ObstacleType[] = ['POLICE', 'TRUCK', 'TAXI', 'BARRIER'];
    const type = types[Math.floor(Math.random() * types.length)];

    const obstacleY = LANE_Y[chosenLane];
    const newObstacle = new Obstacle(spawnX, obstacleY, chosenLane, type);
    this.obstacles.push(newObstacle);
    this.lastSpawnedLane = chosenLane;
  }

  private updateObstacles(dt: number, roadSpeed: number) {
    const playerPoly = this.player.getPolygon();

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const ob = this.obstacles[i];
      ob.update(dt, roadSpeed);

      // Remove off-screen obstacles
      if (ob.x < -200 || ob.isDestroyed) {
        this.obstacles.splice(i, 1);
        continue;
      }

      // Check collision if player is not stunned and obstacle is active
      if (!this.player.isStunned && !ob.isCollided && !ob.isDestroyed) {
        const obPoly = ob.getPolygon();

        // 1. Direct Hitbox Collision (Crash or Fever Smash)
        if (checkAABBOverlap(playerPoly, obPoly) && checkPolygonIntersection(playerPoly, obPoly)) {
          if (this.isFever) {
            // FEVER SMASH! (Invincible Dash Destruction)
            ob.isDestroyed = true;
            this.score += SMASH_POINTS;
            this.smashCount++;
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);

            soundEngine.playSmash();
            this.particles.emitSmashExplosion(ob.x, ob.y);
            this.floatingTexts.add(
              `+${SMASH_POINTS.toLocaleString()} SMASH!`,
              ob.x,
              ob.y - 20,
              '#FFE600',
              this.combo > 1 ? `COMBO x${this.combo}!` : undefined,
              '#FF007F'
            );
          } else {
            // CRASH! (Normal Collision Penalty)
            ob.isCollided = true;

            // If this obstacle previously triggered a near-miss right before impact, REVOKE IT COMPLETELY!
            if (ob.nearMissTriggered) {
              this.score = Math.max(0, this.score - NEAR_MISS_POINTS);
              this.nearMissCount = Math.max(0, this.nearMissCount - 1);
              this.nitro = Math.max(0, this.nitro - NEAR_MISS_NITRO_GAIN);
            }

            // Deduct crash points and penalize nitro so crashing NEVER helps build fever
            this.score = Math.max(0, this.score - CRASH_POINTS);
            this.nitro = Math.max(0, this.nitro - 25); // Drain nitro on crash
            this.crashCount++;
            this.combo = 0; // combo break

            soundEngine.playCrash();
            this.player.triggerStun();
            this.particles.emitCrashSmoke(this.player.x, this.player.y);
            this.floatingTexts.add(
              `-${CRASH_POINTS.toLocaleString()} CRASH!`,
              this.player.x,
              this.player.y - 45,
              '#FF2A4D',
              ob.nearMissTriggered ? '스침 무효 & 니트로 감소!' : '감점 & 니트로 감소!',
              '#000000'
            );
          }
          continue;
        }

        // 2. Near-miss Detection (Within generous expanded margin without crashing)
        if (!ob.nearMissTriggered && !this.isFever && !this.player.isStunned) {
          const nearPoly = ob.getNearMissPolygon();
          if (checkAABBOverlap(playerPoly, nearPoly) && checkPolygonIntersection(playerPoly, nearPoly)) {
            // Trigger Near-Miss!
            ob.nearMissTriggered = true;
            this.score += NEAR_MISS_POINTS;
            this.nearMissCount++;
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);

            // Nitro gauge boost
            this.nitro = Math.min(100, this.nitro + NEAR_MISS_NITRO_GAIN);

            soundEngine.playNearMiss();
            this.particles.emitNearMissSparks(this.player.x + 35, (this.player.y + ob.y) / 2);
            this.floatingTexts.add(
              `+${NEAR_MISS_POINTS.toLocaleString()} NEAR MISS!`,
              this.player.x + 60,
              this.player.y - 40,
              '#00F0FF',
              `NITRO +${NEAR_MISS_NITRO_GAIN}% ${this.combo > 1 ? `(x${this.combo} COMBO!)` : ''}`,
              '#081735'
            );
          }
        }
      }
    }
  }

  private gameOver() {
    this.state = 'GAMEOVER';
    soundEngine.stopEngine();
    soundEngine.playGameOver();

    // Save High Score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('nitro_dash_highscore', this.highScore.toString());
    }

    if (this.onStateChange) this.onStateChange(this.state);
    this.emitStats();
  }

  private emitStats() {
    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.score,
        timeRemaining: this.timeRemaining,
        totalTime: TOTAL_GAME_TIME,
        nitro: this.nitro,
        isFever: this.isFever,
        feverTimeLeft: this.feverTimer,
        combo: this.combo,
        maxCombo: this.maxCombo,
        nearMissCount: this.nearMissCount,
        crashCount: this.crashCount,
        smashCount: this.smashCount,
        highScore: this.highScore,
        currentSpeed: this.isFever ? FEVER_ROAD_SPEED : NORMAL_ROAD_SPEED,
      });
    }
  }

  private render() {
    const ctx = this.ctx;
    const time = performance.now() / 1000;

    ctx.save();

    // Camera Screen Shake
    if (this.particles.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.particles.screenShake;
      const shakeY = (Math.random() - 0.5) * this.particles.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Draw Background & Road
    this.background.draw(ctx, this.isFever, time);

    // 2. Draw Obstacles
    for (const ob of this.obstacles) {
      ob.draw(ctx);
    }

    // 3. Draw Player Car
    this.player.draw(ctx, this.isFever);

    // 4. Draw Particles
    this.particles.draw(ctx);

    // 5. Draw Floating Pop-up Texts
    this.floatingTexts.draw(ctx);

    // 6. Flash screen overlay (Near-miss cyan flash or Crash red flash)
    this.particles.drawFlashOverlay(ctx, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 7. In-Canvas Arcade HUD (Only during active gameplay or pause)
    if (this.state === 'PLAYING' || this.state === 'PAUSED') {
      this.drawInCanvasHUD(ctx);
    }

    ctx.restore();
  }

  private drawInCanvasHUD(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // 1. Top-Left: Time Remaining Card
    const timeSec = Math.max(0, this.timeRemaining);
    const isUrgent = timeSec <= 5.0 && timeSec > 0;
    const timeColor = isUrgent ? '#FF2A4D' : '#00F0FF';

    const leftX = 30;
    const topY = 20;
    const cardH = 64;

    ctx.fillStyle = 'rgba(10, 7, 24, 0.88)';
    ctx.fillRect(leftX, topY, 210, cardH);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = timeColor;
    ctx.strokeRect(leftX, topY, 210, cardH);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px Jua, sans-serif';
    ctx.fillStyle = '#9BA8C7';
    ctx.fillText('남은 시간 (TIME LEFT)', leftX + 16, topY + 8);

    ctx.font = '900 34px Jua, sans-serif';
    ctx.fillStyle = timeColor;
    ctx.shadowBlur = isUrgent ? 12 : 6;
    ctx.shadowColor = timeColor;
    ctx.fillText(`${timeSec.toFixed(1)}s`, leftX + 16, topY + 23);
    ctx.shadowBlur = 0;

    // 2. Top-Center: Nitro Gauge Card
    const centerW = 420;
    const centerX = (VIRTUAL_WIDTH - centerW) / 2;

    ctx.fillStyle = 'rgba(10, 7, 24, 0.88)';
    ctx.fillRect(centerX, topY, centerW, cardH);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.isFever ? '#FFE600' : '#473674';
    ctx.strokeRect(centerX, topY, centerW, cardH);

    // Label on top of bar
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Jua, sans-serif';
    ctx.fillStyle = this.isFever ? '#FFE600' : '#00F0FF';
    ctx.fillText(
      this.isFever
        ? `🔥 FEVER TIME! 무적 질주 중 (${this.feverTimer.toFixed(1)}s) 🔥`
        : `⚡ NITRO GAUGE (${Math.floor(this.nitro)}%) ⚡`,
      VIRTUAL_WIDTH / 2,
      topY + 8
    );

    // Nitro Bar Frame
    const barW = centerW - 32;
    const barH = 20;
    const barX = centerX + 16;
    const barY = topY + 32;

    ctx.fillStyle = '#17122E';
    ctx.fillRect(barX, barY, barW, barH);

    // Bar fill
    const fillW = (barW * Math.min(100, this.nitro)) / 100;
    if (fillW > 0) {
      const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      if (this.isFever) {
        fillGrad.addColorStop(0, '#FF007F');
        fillGrad.addColorStop(0.5, '#FFE600');
        fillGrad.addColorStop(1, '#00F0FF');
      } else {
        fillGrad.addColorStop(0, '#0072FF');
        fillGrad.addColorStop(1, '#00F0FF');
      }
      ctx.fillStyle = fillGrad;
      ctx.fillRect(barX + 2, barY + 2, fillW - 4, barH - 4);
    }

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = this.isFever ? '#FFE600' : '#00F0FF';
    ctx.strokeRect(barX, barY, barW, barH);

    // 3. Top-Right: Score Card
    const rightW = 230;
    const rightX = VIRTUAL_WIDTH - rightW - 30;

    ctx.fillStyle = 'rgba(10, 7, 24, 0.88)';
    ctx.fillRect(rightX, topY, rightW, cardH);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFE600';
    ctx.strokeRect(rightX, topY, rightW, cardH);

    ctx.textAlign = 'right';
    ctx.font = 'bold 12px Jua, sans-serif';
    ctx.fillStyle = '#9BA8C7';
    ctx.fillText('현재 점수 (SCORE)', rightX + rightW - 16, topY + 8);

    ctx.font = '900 34px Jua, sans-serif';
    ctx.fillStyle = '#FFE600';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#FFE600';
    ctx.fillText(this.score.toLocaleString(), rightX + rightW - 16, topY + 23);
    ctx.shadowBlur = 0;

    // 4. Combo Badge (Positioned below score card with clean margin)
    if (this.combo > 1) {
      ctx.textAlign = 'right';
      ctx.font = '900 20px Jua, sans-serif';
      ctx.fillStyle = '#FF007F';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FF007F';
      ctx.fillText(`🔥 ${this.combo} COMBO!`, rightX + rightW - 16, topY + cardH + 26);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}
