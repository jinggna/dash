export interface FloatingTextItem {
  id: number;
  text: string;
  subText?: string;
  x: number;
  y: number;
  color: string;
  strokeColor: string;
  scale: number;
  life: number;
  maxLife: number;
  vy: number;
}

export class FloatingTextManager {
  private items: FloatingTextItem[] = [];
  private nextId = 0;

  public add(
    text: string,
    x: number,
    y: number,
    color: string = '#FFE600',
    subText?: string,
    strokeColor: string = '#000000'
  ) {
    this.items.push({
      id: this.nextId++,
      text,
      subText,
      x,
      y,
      color,
      strokeColor,
      scale: 0.4,
      life: 0.95,
      maxLife: 0.95,
      vy: -95,
    });
  }

  public update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.vy * dt;
      item.vy *= 0.95; // decelerate upward
      item.life -= dt;

      // Pop in scale effect
      if (item.scale < 1.15) {
        item.scale = Math.min(1.15, item.scale + dt * 6.5);
      } else if (item.scale > 1.0) {
        item.scale = Math.max(1.0, item.scale - dt * 2.0);
      }

      if (item.life <= 0) {
        this.items.splice(i, 1);
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const item of this.items) {
      const alpha = Math.max(0, Math.min(1, item.life / (item.maxLife * 0.4)));
      ctx.globalAlpha = alpha;

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.scale(item.scale, item.scale);

      // Pop-up deep shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowOffsetY = 6;
      ctx.shadowBlur = 8;

      ctx.font = '900 28px Jua, sans-serif';

      // Thick black stroke for pop-up paper/arcade look
      ctx.lineWidth = 6;
      ctx.strokeStyle = item.strokeColor;
      ctx.strokeText(item.text, 0, 0);

      // Glowing fill
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, 0, 0);

      // Sub text (e.g. combo multiplier)
      if (item.subText) {
        ctx.font = 'bold 18px Jua, sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(item.subText, 0, 26);
        ctx.fillStyle = '#00F0FF';
        ctx.fillText(item.subText, 0, 26);
      }

      ctx.restore();
    }
    ctx.restore();
  }
}
