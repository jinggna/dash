import { Point, Polygon } from '../types';
import { LANE_Y, STUN_DURATION } from '../constants';

export class PlayerCar {
  public x: number = 220; // Fixed horizontal position
  public y: number;
  public targetY: number;
  public currentLane: number = 0; // 0: Top, 1: Bottom
  public width: number = 115;
  public height: number = 52;

  public tiltAngle: number = 0;
  public targetTilt: number = 0;

  // Stun state
  public isStunned: boolean = false;
  public stunTimer: number = 0;
  public stunSpinAngle: number = 0;

  // Animation timers
  private animTimer: number = 0;
  private afterImages: Array<{ x: number; y: number; angle: number; alpha: number; color: string }> = [];

  constructor() {
    this.y = LANE_Y[0];
    this.targetY = LANE_Y[0];
  }

  public reset() {
    this.currentLane = 0;
    this.y = LANE_Y[0];
    this.targetY = LANE_Y[0];
    this.tiltAngle = 0;
    this.targetTilt = 0;
    this.isStunned = false;
    this.stunTimer = 0;
    this.stunSpinAngle = 0;
    this.afterImages = [];
  }

  public switchLane(direction: 'UP' | 'DOWN'): boolean {
    if (this.isStunned) return false;

    if (direction === 'UP' && this.currentLane > 0) {
      this.currentLane = 0;
      this.targetY = LANE_Y[0];
      this.targetTilt = -0.22; // tilt upwards
      return true;
    } else if (direction === 'DOWN' && this.currentLane < 1) {
      this.currentLane = 1;
      this.targetY = LANE_Y[1];
      this.targetTilt = 0.22; // tilt downwards
      return true;
    }
    return false;
  }

  public triggerStun() {
    this.isStunned = true;
    this.stunTimer = STUN_DURATION;
    this.stunSpinAngle = (Math.random() > 0.5 ? 1 : -1) * 0.35;
  }

  public update(dt: number, isFever: boolean) {
    this.animTimer += dt;

    // Handle stun
    if (this.isStunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.isStunned = false;
        this.stunSpinAngle = 0;
      } else {
        this.stunSpinAngle *= 0.92;
      }
    }

    // Smooth lane transition (Lerp with dampening)
    const diffY = this.targetY - this.y;
    this.y += diffY * Math.min(1, dt * 14);

    // Smooth tilt recovery
    if (Math.abs(diffY) < 4) {
      this.targetTilt = 0;
    }
    this.tiltAngle += (this.targetTilt - this.tiltAngle) * Math.min(1, dt * 12);

    // Afterimages during Fever
    if (isFever && !this.isStunned) {
      this.afterImages.push({
        x: this.x,
        y: this.y,
        angle: this.tiltAngle,
        alpha: 0.6,
        color: Math.random() > 0.5 ? '#FF007F' : '#00F0FF',
      });
    }

    // Update afterimages
    for (let i = this.afterImages.length - 1; i >= 0; i--) {
      const img = this.afterImages[i];
      img.x -= dt * 450; // trail moves backward
      img.alpha -= dt * 2.8;
      if (img.alpha <= 0) {
        this.afterImages.splice(i, 1);
      }
    }
  }

  /**
   * Generates exact polygon vertices hugging the player supercar
   * Facing RIGHT
   */
  public getPolygon(): Polygon {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;
    const angle = this.isStunned ? this.stunSpinAngle : this.tiltAngle;

    // Base local polygon (facing right: front is +X)
    const localPts: Point[] = [
      { x: halfW, y: 2 }, // Front bumper nose
      { x: halfW - 14, y: -halfH + 12 }, // Front hood slope
      { x: halfW - 36, y: -halfH + 4 }, // Windshield top
      { x: -halfW * 0.35, y: -halfH + 4 }, // Roof back
      { x: -halfW * 0.7, y: -halfH + 14 }, // Rear window slope
      { x: -halfW, y: -halfH + 18 }, // Rear wing spoiler
      { x: -halfW, y: halfH - 8 }, // Rear diffuser
      { x: halfW - 12, y: halfH - 8 }, // Front lower lip
    ];

    // Rotate and translate
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return localPts.map((pt) => ({
      x: cx + pt.x * cos - pt.y * sin,
      y: cy + pt.x * sin + pt.y * cos,
    }));
  }

  public draw(ctx: CanvasRenderingContext2D, isFever: boolean) {
    ctx.save();

    // 1. Draw Fever Trail Afterimages
    for (const img of this.afterImages) {
      ctx.save();
      ctx.translate(img.x, img.y);
      ctx.rotate(img.angle);
      ctx.globalAlpha = img.alpha;
      ctx.fillStyle = img.color;
      ctx.fillRect(-this.width / 2, -this.height / 2 + 8, this.width, this.height - 16);
      ctx.restore();
    }

    // 2. Headlight beam projecting onto road (Facing Right)
    if (!this.isStunned) {
      this.drawHeadlights(ctx, isFever);
    }

    // Transform car position and rotation
    ctx.translate(this.x, this.y);
    const angle = this.isStunned ? this.stunSpinAngle : this.tiltAngle;
    ctx.rotate(angle);

    // 3. Pop-up book deep drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowOffsetY = 16;
    ctx.shadowBlur = 14;

    // 4. Car Body
    this.drawCarBody(ctx, isFever);

    // 5. Fever Electric Aura / Shield
    if (isFever && !this.isStunned) {
      this.drawFeverShield(ctx);
    }

    ctx.restore();
  }

  private drawHeadlights(ctx: CanvasRenderingContext2D, isFever: boolean) {
    ctx.save();
    const beamStartX = this.x + this.width / 2;
    const beamStartY = this.y;
    const beamLength = isFever ? 320 : 220;

    const grad = ctx.createRadialGradient(
      beamStartX,
      beamStartY,
      10,
      beamStartX + beamLength * 0.7,
      beamStartY,
      beamLength
    );
    grad.addColorStop(0, isFever ? 'rgba(255, 0, 128, 0.45)' : 'rgba(0, 240, 255, 0.4)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamStartY - 10);
    ctx.lineTo(beamStartX + beamLength, beamStartY - 55);
    ctx.lineTo(beamStartX + beamLength, beamStartY + 55);
    ctx.lineTo(beamStartX, beamStartY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawCarBody(ctx: CanvasRenderingContext2D, isFever: boolean) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;

    // Base chassis polygon
    const basePts: Point[] = [
      { x: halfW, y: 2 },
      { x: halfW - 14, y: -halfH + 12 },
      { x: halfW - 36, y: -halfH + 4 },
      { x: -halfW * 0.35, y: -halfH + 4 },
      { x: -halfW * 0.7, y: -halfH + 14 },
      { x: -halfW, y: -halfH + 18 },
      { x: -halfW, y: halfH - 8 },
      { x: halfW - 12, y: halfH - 8 },
    ];

    // Car gradient paint
    const bodyGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
    if (isFever) {
      bodyGrad.addColorStop(0, '#FF007F');
      bodyGrad.addColorStop(0.5, '#FFE600');
      bodyGrad.addColorStop(1, '#00F0FF');
    } else {
      bodyGrad.addColorStop(0, '#0E0922');
      bodyGrad.addColorStop(0.5, '#1E1747');
      bodyGrad.addColorStop(1, '#00C3FF');
    }

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(basePts[0].x, basePts[0].y);
    for (let i = 1; i < basePts.length; i++) {
      ctx.lineTo(basePts[i].x, basePts[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Pop-up bold dark outline
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#040209';
    ctx.stroke();

    // Cyber cockpit glass
    ctx.fillStyle = isFever ? '#FFE600' : '#00F0FF';
    ctx.beginPath();
    ctx.moveTo(halfW - 38, -halfH + 6);
    ctx.lineTo(-halfW * 0.28, -halfH + 6);
    ctx.lineTo(-halfW * 0.28, -2);
    ctx.lineTo(halfW - 30, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Neon racing side stripe
    ctx.fillStyle = isFever ? '#FF007F' : '#00F0FF';
    ctx.fillRect(-halfW + 24, 0, this.width - 44, 4);

    // Rear spoiler wing
    ctx.fillStyle = '#06030F';
    ctx.fillRect(-halfW, -halfH + 8, 14, 5);
    ctx.strokeRect(-halfW, -halfH + 8, 14, 5);

    // Front headlights
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 12;
    ctx.shadowColor = isFever ? '#FF007F' : '#00F0FF';
    ctx.fillRect(halfW - 8, -2, 6, 8);
    ctx.shadowBlur = 0;

    // Rear taillights (Neon crimson)
    ctx.fillStyle = '#FF0033';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FF0033';
    ctx.fillRect(-halfW, 2, 4, 10);
    ctx.shadowBlur = 0;

    // Rims / Wheels
    ctx.fillStyle = '#07050E';
    ctx.fillRect(-halfW + 18, halfH - 10, 20, 8);
    ctx.fillRect(halfW - 36, halfH - 10, 20, 8);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#372C54';
    ctx.strokeRect(-halfW + 18, halfH - 10, 20, 8);
    ctx.strokeRect(halfW - 36, halfH - 10, 20, 8);

    // Gold / Cyan rim caps
    ctx.fillStyle = isFever ? '#FFE600' : '#00F0FF';
    ctx.fillRect(-halfW + 25, halfH - 8, 6, 4);
    ctx.fillRect(halfW - 29, halfH - 8, 6, 4);
  }

  private drawFeverShield(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const pulse = Math.sin(this.animTimer * 12) * 4;
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#FFE600';

    ctx.strokeStyle = '#FFF176';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.width * 0.65 + pulse, this.height * 0.75 + pulse, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Rainbow electricity arcs
    for (let i = 0; i < 4; i++) {
      const arcAngle = this.animTimer * 10 + (i * Math.PI) / 2;
      const arcX = Math.cos(arcAngle) * (this.width * 0.65);
      const arcY = Math.sin(arcAngle) * (this.height * 0.75);

      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.arc(arcX, arcY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
