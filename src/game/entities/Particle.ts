import { Point } from '../types';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
  shape: 'circle' | 'square' | 'spark' | 'shard';
  rotation?: number;
  vRot?: number;
}

export interface SpeedStreak {
  x: number;
  y: number;
  length: number;
  speed: number;
  width: number;
  color: string;
  glowColor: string;
  alpha: number;
}

export type ShakeType = 'NEAR_MISS' | 'CRASH' | 'SMASH';

export class ParticleSystem {
  private particles: Particle[] = [];
  public speedStreaks: SpeedStreak[] = [];
  public feverIntensity: number = 0;

  // Differentiated Screen-Shake System
  public shakeOffsetX: number = 0;
  public shakeOffsetY: number = 0;
  public shakeRotation: number = 0;
  public screenShake: number = 0; // magnitude for backwards compatibility
  public shakeTrauma: number = 0; // 0 to 1 non-linear trauma
  private shakeType: ShakeType = 'NEAR_MISS';
  private shakeTime: number = 0;
  private recoilX: number = 0;

  public flashAlpha: number = 0;
  public flashColor: string = '#FFFFFF';

  public update(dt: number, isFever: boolean = false) {
    this.shakeTime += dt;

    // Smooth fever intensity transition
    if (isFever) {
      this.feverIntensity = Math.min(1, this.feverIntensity + dt * 4.5);
    } else {
      this.feverIntensity = Math.max(0, this.feverIntensity - dt * 2.8);
    }

    // Update screen shake trauma and compute directional/rotational offsets
    this.updateScreenShake(dt);

    // Flash decay
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 4.5);
    }

    // Update standard particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = (p.life / p.maxLife) * p.maxAlpha;

      if (p.vRot !== undefined && p.rotation !== undefined) {
        p.rotation += p.vRot * dt;
      }

      // Drag
      p.vx *= 0.96;
      p.vy *= 0.96;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update Fever Speed Streaks
    this.updateSpeedStreaks(dt);
  }

  private updateSpeedStreaks(dt: number) {
    const targetCount = this.feverIntensity > 0.05 ? Math.floor(48 * this.feverIntensity) : 0;
    const colors = ['#00F0FF', '#FF007F', '#FFE600', '#FFFFFF', '#9D00FF', '#00FF99'];

    // Spawn new streaks to maintain pool during Fever
    while (this.speedStreaks.length < targetCount) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.speedStreaks.push({
        x: Math.random() * 1200 + 400, // spawn across or ahead
        y: Math.random() * 650,
        length: Math.random() * 260 + 140,
        speed: Math.random() * 1400 + 1800, // blazing fast (1800 - 3200 px/s)
        width: Math.random() * 3.5 + 1.5,
        color,
        glowColor: color,
        alpha: Math.random() * 0.45 + 0.45,
      });
    }

    // Move existing streaks
    for (let i = this.speedStreaks.length - 1; i >= 0; i--) {
      const s = this.speedStreaks[i];
      s.x -= s.speed * dt;

      // When streak leaves the left side of screen
      if (s.x + s.length < 0) {
        if (this.speedStreaks.length > targetCount) {
          this.speedStreaks.splice(i, 1);
        } else {
          // Recycle streak on the right
          s.x = 1200 + Math.random() * 250;
          s.y = Math.random() * 650;
          s.length = Math.random() * 260 + 140;
          s.speed = Math.random() * 1400 + 1800;
          s.width = Math.random() * 3.5 + 1.5;
          const color = colors[Math.floor(Math.random() * colors.length)];
          s.color = color;
          s.glowColor = color;
          s.alpha = Math.random() * 0.45 + 0.45;
        }
      }
    }
  }

  public emitFeverBurst() {
    const colors = ['#00F0FF', '#FF007F', '#FFE600', '#FFFFFF', '#00FF99'];
    // Instant wave of hyper-speed streaks tearing across screen
    for (let i = 0; i < 35; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.speedStreaks.push({
        x: Math.random() * 1200,
        y: Math.random() * 650,
        length: Math.random() * 380 + 180,
        speed: Math.random() * 1800 + 2200,
        width: Math.random() * 4.5 + 2,
        color,
        glowColor: color,
        alpha: Math.random() * 0.4 + 0.6,
      });
    }
  }

  private updateScreenShake(dt: number) {
    if (this.shakeTrauma > 0) {
      // Non-linear decay depending on shake type
      const decayRate = this.shakeType === 'NEAR_MISS' ? 3.4 : this.shakeType === 'CRASH' ? 1.9 : 2.6;
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * decayRate);

      // Quadratic curve for punchy trauma response (trauma^2)
      const intensity = Math.pow(this.shakeTrauma, 2);

      if (this.shakeType === 'NEAR_MISS') {
        // Minor aerodynamic flutter: snappy high-frequency vibration with quick recovery (~0.14s)
        this.shakeOffsetX = Math.sin(this.shakeTime * 70) * 5.5 * intensity;
        this.shakeOffsetY = Math.cos(this.shakeTime * 60) * 4.5 * intensity;
        this.shakeRotation = Math.sin(this.shakeTime * 50) * 0.012 * intensity;
      } else if (this.shakeType === 'CRASH') {
        // Heavy, jarring shock: violent multi-axis displacement, deceleration kickback, and camera roll
        this.recoilX *= Math.pow(0.04, dt);
        this.shakeOffsetX =
          (Math.sin(this.shakeTime * 38) * 24 + (Math.random() - 0.5) * 14) * intensity + this.recoilX;
        this.shakeOffsetY =
          (Math.cos(this.shakeTime * 48) * 20 + (Math.random() - 0.5) * 12) * intensity;
        this.shakeRotation =
          (Math.sin(this.shakeTime * 30) * 0.048 + (Math.random() - 0.5) * 0.02) * intensity;
      } else {
        // SMASH: punchy forward shockwave
        this.recoilX *= Math.pow(0.08, dt);
        this.shakeOffsetX = Math.sin(this.shakeTime * 52) * 14 * intensity + this.recoilX;
        this.shakeOffsetY = Math.cos(this.shakeTime * 58) * 12 * intensity;
        this.shakeRotation = Math.sin(this.shakeTime * 42) * 0.02 * intensity;
      }

      this.screenShake = Math.hypot(this.shakeOffsetX, this.shakeOffsetY);
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRotation = 0;
      this.screenShake = 0;
      this.recoilX = 0;
    }
  }

  public triggerNearMissShake() {
    this.shakeType = 'NEAR_MISS';
    this.shakeTrauma = Math.max(this.shakeTrauma, 0.45);
  }

  public triggerCrashShake() {
    this.shakeType = 'CRASH';
    this.shakeTrauma = 1.0;
    this.recoilX = -26; // violent deceleration recoil kick
  }

  public triggerSmashShake() {
    this.shakeType = 'SMASH';
    this.shakeTrauma = Math.max(this.shakeTrauma, 0.8);
    this.recoilX = 10;
  }

  public triggerShake(intensity: number) {
    if (intensity >= 12) {
      this.triggerCrashShake();
    } else {
      this.triggerNearMissShake();
    }
  }

  public triggerFlash(color: string = '#FFFFFF', initialAlpha: number = 0.5) {
    this.flashColor = color;
    this.flashAlpha = initialAlpha;
  }

  public emitNearMissSparks(x: number, y: number) {
    this.triggerFlash('#00F0FF', 0.45);
    this.triggerNearMissShake();

    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5);
      const speed = Math.random() * 350 + 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed - 150, // drift back with road
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 3,
        color: Math.random() > 0.4 ? '#00F0FF' : '#FFE600',
        alpha: 1,
        maxAlpha: 1,
        life: Math.random() * 0.35 + 0.2,
        maxLife: 0.5,
        shape: 'spark',
      });
    }
  }

  public emitCrashSmoke(x: number, y: number) {
    this.triggerFlash('#FF0033', 0.65);
    this.triggerCrashShake();

    // Violent metal sparks
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 450 + 100;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.5 ? '#FF3300' : '#FFE600',
        alpha: 1,
        maxAlpha: 1,
        life: Math.random() * 0.45 + 0.2,
        maxLife: 0.65,
        shape: 'spark',
      });
    }

    // Heavy dark smoke puffs
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 20,
        vx: -Math.random() * 150 - 50,
        vy: (Math.random() - 0.5) * 120 - 40,
        size: Math.random() * 16 + 12,
        color: '#342947',
        alpha: 0.8,
        maxAlpha: 0.8,
        life: Math.random() * 0.6 + 0.3,
        maxLife: 0.9,
        shape: 'circle',
      });
    }
  }

  public emitSmashExplosion(x: number, y: number) {
    this.triggerFlash('#FFE600', 0.7);
    this.triggerSmashShake();

    const colors = ['#FF007F', '#00F0FF', '#FFE600', '#FFFFFF', '#9D00FF'];

    // Flying polygon shards / debris
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 600 + 200;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 14 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        maxAlpha: 1,
        life: Math.random() * 0.5 + 0.35,
        maxLife: 0.85,
        shape: 'shard',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 15,
      });
    }
  }

  public emitExhaustFlame(x: number, y: number, isFever: boolean) {
    const count = isFever ? 4 : 2;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x - Math.random() * 6,
        y: y + (Math.random() - 0.5) * 10,
        vx: -Math.random() * 400 - (isFever ? 600 : 300),
        vy: (Math.random() - 0.5) * 40,
        size: Math.random() * (isFever ? 12 : 7) + 4,
        color: isFever
          ? Math.random() > 0.5
            ? '#FFE600'
            : '#FF007F'
          : Math.random() > 0.4
          ? '#00F0FF'
          : '#4D82FF',
        alpha: 0.9,
        maxAlpha: 0.9,
        life: Math.random() * 0.14 + 0.08,
        maxLife: 0.22,
        shape: 'circle',
      });
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.save();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
        ctx.restore();
      } else if (p.shape === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.rotation !== undefined) ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  public drawFlashOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (this.flashAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.flashAlpha);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  /**
   * Renders the Fever Time 'speed blur' and 'streaking light' particle effect across the canvas
   */
  public drawSpeedBlur(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (this.feverIntensity <= 0.01) return;

    ctx.save();

    // 1. Streaking Light Laser Particles across the entire canvas
    for (const s of this.speedStreaks) {
      const alpha = Math.min(1, s.alpha * this.feverIntensity);
      if (alpha <= 0.01) continue;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Laser gradient: brilliant white leading tip, saturated neon body, fading tail
      const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.length, s.y);
      grad.addColorStop(0, '#FFFFFF'); // piercing bright head
      grad.addColorStop(0.2, s.color); // glowing neon hue
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); // speed blur tail

      ctx.shadowBlur = 14 * this.feverIntensity;
      ctx.shadowColor = s.glowColor;
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.length, s.y);
      ctx.stroke();

      // Sharp core spark at the leading head of the streak
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.width * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 2. High-speed Anamorphic Edge Speed Blur (Top & Bottom borders)
    const edgeBlurH = 95;
    const intensity = this.feverIntensity;

    // Top edge motion-blur wash
    const topGrad = ctx.createLinearGradient(0, 0, 0, edgeBlurH);
    topGrad.addColorStop(0, `rgba(255, 0, 128, ${0.28 * intensity})`);
    topGrad.addColorStop(0.4, `rgba(0, 240, 255, ${0.15 * intensity})`);
    topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, edgeBlurH);

    // Bottom edge motion-blur wash
    const btmGrad = ctx.createLinearGradient(0, height, 0, height - edgeBlurH);
    btmGrad.addColorStop(0, `rgba(0, 240, 255, ${0.28 * intensity})`);
    btmGrad.addColorStop(0.4, `rgba(255, 0, 128, ${0.15 * intensity})`);
    btmGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = btmGrad;
    ctx.fillRect(0, height - edgeBlurH, width, edgeBlurH);

    // 3. Horizontal Chromatic Streak Lines at extreme borders
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#00F0FF';
    ctx.globalAlpha = 0.35 * intensity;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(width, 4);
    ctx.moveTo(0, height - 4);
    ctx.lineTo(width, height - 4);
    ctx.stroke();

    ctx.strokeStyle = '#FF007F';
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(width, 8);
    ctx.moveTo(0, height - 8);
    ctx.lineTo(width, height - 8);
    ctx.stroke();

    ctx.restore();
  }
}

