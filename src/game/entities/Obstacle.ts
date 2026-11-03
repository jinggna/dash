import { Point, Polygon, ObstacleType } from '../types';
import { expandPolygon } from '../collision';
import { NEAR_MISS_EXPANSION_X, NEAR_MISS_EXPANSION_Y } from '../constants';

export class Obstacle {
  public x: number;
  public y: number;
  public lane: number; // 0: Top, 1: Bottom
  public type: ObstacleType;
  public width: number;
  public height: number;
  public speed: number; // Autonomous forward speed relative to road
  public isDestroyed: boolean = false;
  public isCollided: boolean = false;
  public nearMissTriggered: boolean = false;
  public sirenTimer: number = 0;

  constructor(x: number, y: number, lane: number, type?: ObstacleType) {
    this.x = x;
    this.y = y;
    this.lane = lane;

    // Pick obstacle type if not provided
    const types: ObstacleType[] = ['POLICE', 'TRUCK', 'TAXI', 'BARRIER'];
    this.type = type || types[Math.floor(Math.random() * types.length)];

    // Dimensions and speeds based on type
    switch (this.type) {
      case 'POLICE':
        this.width = 110;
        this.height = 54;
        this.speed = -80; // drives slower than road, relative motion leftwards
        break;
      case 'TRUCK':
        this.width = 160;
        this.height = 68;
        this.speed = -140; // heavy slow vehicle
        break;
      case 'TAXI':
        this.width = 105;
        this.height = 52;
        this.speed = -100;
        break;
      case 'BARRIER':
        this.width = 75;
        this.height = 50;
        this.speed = 0; // stationary hazard
        break;
    }
  }

  public update(dt: number, roadSpeed: number) {
    // Relative speed moves obstacle towards left
    const effectiveSpeed = roadSpeed + this.speed;
    this.x -= effectiveSpeed * dt;
    this.sirenTimer += dt * 10;
  }

  /**
   * Generates exact polygon vertices hugging the vehicle/barrier silhouette
   */
  public getPolygon(): Polygon {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;

    if (this.type === 'BARRIER') {
      return [
        { x: cx - halfW + 6, y: cy - halfH },
        { x: cx + halfW - 6, y: cy - halfH },
        { x: cx + halfW, y: cy + halfH },
        { x: cx - halfW, y: cy + halfH },
      ];
    }

    if (this.type === 'TRUCK') {
      return [
        { x: cx - halfW, y: cy - halfH + 4 },
        { x: cx + halfW * 0.45, y: cy - halfH + 4 },
        { x: cx + halfW * 0.75, y: cy - halfH + 14 },
        { x: cx + halfW, y: cy - halfH + 18 },
        { x: cx + halfW, y: cy + halfH - 4 },
        { x: cx - halfW, y: cy + halfH - 4 },
      ];
    }

    // Aerodynamic cars (Police, Taxi)
    // Facing LEFT (since oncoming traffic or moving slower than player)
    return [
      { x: cx - halfW, y: cy + 4 }, // Front nose
      { x: cx - halfW + 16, y: cy - halfH + 12 }, // Hood slope
      { x: cx - halfW + 36, y: cy - halfH + 4 }, // Windshield top
      { x: cx + halfW * 0.35, y: cy - halfH + 4 }, // Roof back
      { x: cx + halfW * 0.7, y: cy - halfH + 14 }, // Rear window
      { x: cx + halfW, y: cy - halfH + 18 }, // Trunk
      { x: cx + halfW, y: cy + halfH - 8 }, // Rear bumper
      { x: cx - halfW + 10, y: cy + halfH - 8 }, // Front bumper
    ];
  }

  /**
   * Generates near-miss detection polygon expanded by NEAR_MISS_EXPANSION_X and Y
   */
  public getNearMissPolygon(): Polygon {
    return expandPolygon(this.getPolygon(), NEAR_MISS_EXPANSION_X, NEAR_MISS_EXPANSION_Y);
  }

  public draw(ctx: CanvasRenderingContext2D) {
    if (this.isDestroyed) return;

    ctx.save();

    // Subtle holographic near-miss proximity field (shows player the graze zone)
    if (!this.nearMissTriggered && !this.isCollided && this.x < 1150 && this.x > 50) {
      const nearPoly = this.getNearMissPolygon();
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(nearPoly[0].x, nearPoly[0].y);
      for (let i = 1; i < nearPoly.length; i++) {
        ctx.lineTo(nearPoly[i].x, nearPoly[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // 1. Pop-up book deep drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowOffsetY = 16;
    ctx.shadowBlur = 12;

    switch (this.type) {
      case 'POLICE':
        this.drawPolice(ctx);
        break;
      case 'TRUCK':
        this.drawTruck(ctx);
        break;
      case 'TAXI':
        this.drawTaxi(ctx);
        break;
      case 'BARRIER':
        this.drawBarrier(ctx);
        break;
    }

    ctx.restore();
  }

  private drawPolice(ctx: CanvasRenderingContext2D) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;

    // Chassis body
    ctx.fillStyle = '#101018'; // Sleek dark cyber cop
    const poly = this.getPolygon();

    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Pop-up thick outline
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#05030A';
    ctx.stroke();

    // White door panel
    ctx.fillStyle = '#E8ECEF';
    ctx.fillRect(cx - 15, cy - halfH + 12, 36, halfH + 6);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#05030A';
    ctx.strokeRect(cx - 15, cy - halfH + 12, 36, halfH + 6);

    // "POLICE" text
    ctx.font = '900 10px Jua, sans-serif';
    ctx.fillStyle = '#0F1221';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', cx + 3, cy + 2);

    // Windshield & windows (Cyber Cyan reflective tint)
    ctx.fillStyle = '#00F0FF';
    ctx.beginPath();
    ctx.moveTo(cx - halfW + 36, cy - halfH + 6);
    ctx.lineTo(cx + halfW * 0.25, cy - halfH + 6);
    ctx.lineTo(cx + halfW * 0.25, cy - 4);
    ctx.lineTo(cx - halfW + 28, cy - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red & Blue flashing Siren beacon on roof
    const sirenFlash = Math.sin(this.sirenTimer) > 0;
    const redLight = sirenFlash ? '#FF0033' : '#660011';
    const blueLight = !sirenFlash ? '#0099FF' : '#002266';

    // Siren mount
    ctx.fillStyle = '#222230';
    ctx.fillRect(cx - 8, cy - halfH + 1, 16, 5);

    // Left light (Red)
    ctx.shadowBlur = sirenFlash ? 14 : 0;
    ctx.shadowColor = '#FF0033';
    ctx.fillStyle = redLight;
    ctx.fillRect(cx - 8, cy - halfH - 3, 7, 5);

    // Right light (Blue)
    ctx.shadowBlur = !sirenFlash ? 14 : 0;
    ctx.shadowColor = '#0099FF';
    ctx.fillStyle = blueLight;
    ctx.fillRect(cx + 1, cy - halfH - 3, 7, 5);
    ctx.shadowBlur = 0;

    // Headlights (Facing left)
    ctx.fillStyle = '#FFF275';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFF275';
    ctx.fillRect(cx - halfW, cy + 2, 4, 8);
    ctx.shadowBlur = 0;

    // Wheels
    this.drawWheels(ctx, cx - halfW + 22, cx + halfW - 22, cy + halfH - 4);
  }

  private drawTruck(ctx: CanvasRenderingContext2D) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;

    // Truck container
    ctx.fillStyle = '#1D1933';
    ctx.fillRect(cx - halfW, cy - halfH + 6, this.width * 0.65, this.height - 12);

    // Truck cabin
    ctx.fillStyle = '#FF5E00';
    ctx.fillRect(cx + this.width * 0.15, cy - halfH + 10, this.width * 0.35, this.height - 16);

    // Pop-up thick outline
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#05030A';
    ctx.strokeRect(cx - halfW, cy - halfH + 6, this.width * 0.65, this.height - 12);
    ctx.strokeRect(cx + this.width * 0.15, cy - halfH + 10, this.width * 0.35, this.height - 16);

    // Neon hazard stripes on container
    ctx.fillStyle = '#FFE600';
    for (let x = cx - halfW + 12; x < cx + this.width * 0.1; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, cy - halfH + 12);
      ctx.lineTo(x + 10, cy - halfH + 12);
      ctx.lineTo(x - 4, cy + halfH - 12);
      ctx.lineTo(x - 14, cy + halfH - 12);
      ctx.closePath();
      ctx.fill();
    }

    // Cabin windshield
    ctx.fillStyle = '#00F0FF';
    ctx.fillRect(cx + this.width * 0.35, cy - halfH + 14, 16, 18);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(cx + this.width * 0.35, cy - halfH + 14, 16, 18);

    // Wheels (Heavy 3 axles)
    this.drawWheels(ctx, cx - halfW + 24, cx + this.width * 0.38, cy + halfH - 4);
    this.drawWheels(ctx, cx - halfW + 55, cx + this.width * 0.38, cy + halfH - 4);
  }

  private drawTaxi(ctx: CanvasRenderingContext2D) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;

    const poly = this.getPolygon();

    // Body
    ctx.fillStyle = '#FFB800'; // Bright cyber taxi yellow
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Pop-up outline
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#08050E';
    ctx.stroke();

    // Checkerboard stripe on side
    ctx.fillStyle = '#000000';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(cx - 20 + i * 12, cy - 2, 6, 6);
      ctx.fillRect(cx - 14 + i * 12, cy + 4, 6, 6);
    }

    // Taxi roof sign
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFF8E1';
    ctx.fillRect(cx - 10, cy - halfH - 2, 20, 7);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(cx - 10, cy - halfH - 2, 20, 7);

    ctx.font = 'bold 7px Jua, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', cx, cy - halfH + 4);

    // Windshield
    ctx.fillStyle = '#00F0FF';
    ctx.beginPath();
    ctx.moveTo(cx - halfW + 34, cy - halfH + 8);
    ctx.lineTo(cx + halfW * 0.3, cy - halfH + 8);
    ctx.lineTo(cx + halfW * 0.3, cy - 2);
    ctx.lineTo(cx - halfW + 26, cy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wheels
    this.drawWheels(ctx, cx - halfW + 20, cx + halfW - 20, cy + halfH - 4);
  }

  private drawBarrier(ctx: CanvasRenderingContext2D) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;

    // Barrier board
    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(cx - halfW, cy - halfH + 8, this.width, this.height - 16);

    // Pop-up thick outline
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#090510';
    ctx.strokeRect(cx - halfW, cy - halfH + 8, this.width, this.height - 16);

    // Red warning chevrons
    ctx.fillStyle = '#FF2A4D';
    for (let x = cx - halfW + 8; x < cx + halfW; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, cy - halfH + 8);
      ctx.lineTo(x + 8, cy - halfH + 8);
      ctx.lineTo(x, cy + halfH - 8);
      ctx.lineTo(x - 8, cy + halfH - 8);
      ctx.closePath();
      ctx.fill();
    }

    // Blinking yellow hazard lamp on top
    const blink = Math.sin(this.sirenTimer * 1.5) > 0;
    ctx.fillStyle = '#261F38';
    ctx.fillRect(cx - 6, cy - halfH + 2, 12, 6);

    ctx.shadowBlur = blink ? 16 : 0;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = blink ? '#FFF275' : '#8C7A00';
    ctx.beginPath();
    ctx.arc(cx, cy - halfH + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Stand legs
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#261F38';
    ctx.beginPath();
    ctx.moveTo(cx - halfW + 10, cy + halfH - 8);
    ctx.lineTo(cx - halfW + 6, cy + halfH + 2);
    ctx.moveTo(cx + halfW - 10, cy + halfH - 8);
    ctx.lineTo(cx + halfW - 6, cy + halfH + 2);
    ctx.stroke();
  }

  private drawWheels(ctx: CanvasRenderingContext2D, frontX: number, rearX: number, wheelY: number) {
    ctx.save();
    ctx.fillStyle = '#080510';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#322B42';

    // Front wheel
    ctx.fillRect(frontX - 8, wheelY - 4, 16, 8);
    ctx.strokeRect(frontX - 8, wheelY - 4, 16, 8);

    // Rear wheel
    ctx.fillRect(rearX - 8, wheelY - 4, 16, 8);
    ctx.strokeRect(rearX - 8, wheelY - 4, 16, 8);
    ctx.restore();
  }
}
