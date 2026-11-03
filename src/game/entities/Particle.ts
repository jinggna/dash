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

export class ParticleSystem {
  private particles: Particle[] = [];
  public screenShake: number = 0;
  public flashAlpha: number = 0;
  public flashColor: string = '#FFFFFF';

  public update(dt: number) {
    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    // Flash decay
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 4.5);
    }

    // Update particles
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
  }

  public triggerShake(intensity: number) {
    this.screenShake = Math.max(this.screenShake, intensity);
  }

  public triggerFlash(color: string = '#FFFFFF', initialAlpha: number = 0.5) {
    this.flashColor = color;
    this.flashAlpha = initialAlpha;
  }

  public emitNearMissSparks(x: number, y: number) {
    this.triggerFlash('#00F0FF', 0.45);
    this.triggerShake(4);

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
    this.triggerFlash('#FF0033', 0.6);
    this.triggerShake(16);

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
    this.triggerShake(14);

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
}
