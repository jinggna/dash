import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  ROAD_TOP,
  ROAD_BOTTOM,
  LANE_HEIGHT,
  NORMAL_ROAD_SPEED,
} from '../constants';

interface Building {
  x: number;
  width: number;
  height: number;
  color: string;
  windowCols: number;
  windowRows: number;
  windowGlowColor: string;
  hasAntenna: boolean;
  neonSign?: { text: string; color: string };
}

interface Tree {
  x: number;
  height: number;
  type: number;
}

interface Streetlight {
  x: number;
}

export class Background {
  private starSeeds: Array<{ x: number; y: number; size: number; alpha: number; speed: number }> = [];
  private farBuildings: Building[] = [];
  private midBuildings: Building[] = [];
  private streetlights: Streetlight[] = [];
  private trees: Tree[] = [];
  private roadOffset: number = 0;
  private farOffset: number = 0;
  private midOffset: number = 0;
  private roadsideOffset: number = 0;
  private speedLines: Array<{ x: number; y: number; length: number; speed: number; alpha: number }> = [];

  constructor() {
    this.initStars();
    this.initBuildings();
    this.initRoadside();
    this.initSpeedLines();
  }

  private initStars() {
    this.starSeeds = [];
    for (let i = 0; i < 70; i++) {
      this.starSeeds.push({
        x: Math.random() * VIRTUAL_WIDTH,
        y: Math.random() * (ROAD_TOP - 40),
        size: Math.random() * 2 + 0.8,
        alpha: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.05 + 0.02,
      });
    }
  }

  private initBuildings() {
    // Far layer (dark purple silhouettes with neon signs)
    const neonWords = ['NITRO', 'CYBER', 'DASH', '2077', 'NEON', 'BAR', 'HOTEL'];
    const neonColors = ['#00F0FF', '#FF007F', '#FFE600', '#00FF66', '#9D00FF'];
    let curX = 0;
    while (curX < VIRTUAL_WIDTH * 2.5) {
      const width = Math.random() * 70 + 60;
      const height = Math.random() * 140 + 100;
      const hasSign = Math.random() > 0.45;
      this.farBuildings.push({
        x: curX,
        width,
        height,
        color: '#150f2f',
        windowCols: Math.floor(width / 14),
        windowRows: Math.floor(height / 18),
        windowGlowColor: 'rgba(255, 230, 100, 0.4)',
        hasAntenna: Math.random() > 0.6,
        neonSign: hasSign
          ? {
              text: neonWords[Math.floor(Math.random() * neonWords.length)],
              color: neonColors[Math.floor(Math.random() * neonColors.length)],
            }
          : undefined,
      });
      curX += width + 12;
    }

    // Mid layer (closer skyscrapers with bright neon borders and detail)
    curX = 0;
    while (curX < VIRTUAL_WIDTH * 2.5) {
      const width = Math.random() * 85 + 75;
      const height = Math.random() * 110 + 70;
      this.midBuildings.push({
        x: curX,
        width,
        height,
        color: '#1e1442',
        windowCols: Math.floor(width / 16),
        windowRows: Math.floor(height / 20),
        windowGlowColor: 'rgba(0, 240, 255, 0.5)',
        hasAntenna: Math.random() > 0.5,
      });
      curX += width + 20;
    }
  }

  private initRoadside() {
    for (let x = 0; x < VIRTUAL_WIDTH * 2.5; x += 320) {
      this.streetlights.push({ x });
    }
    for (let x = 50; x < VIRTUAL_WIDTH * 2.5; x += 180) {
      this.trees.push({
        x,
        height: Math.random() * 25 + 45,
        type: Math.floor(Math.random() * 2),
      });
    }
  }

  private initSpeedLines() {
    this.speedLines = [];
    for (let i = 0; i < 25; i++) {
      this.speedLines.push({
        x: Math.random() * VIRTUAL_WIDTH,
        y: ROAD_TOP + Math.random() * (ROAD_BOTTOM - ROAD_TOP),
        length: Math.random() * 90 + 50,
        speed: Math.random() * 400 + 700,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }
  }

  public update(dt: number, speed: number) {
    const speedRatio = speed / NORMAL_ROAD_SPEED;

    // Parallax scrolls
    this.farOffset = (this.farOffset + speed * 0.18 * dt) % (VIRTUAL_WIDTH * 1.5);
    this.midOffset = (this.midOffset + speed * 0.45 * dt) % (VIRTUAL_WIDTH * 1.5);
    this.roadsideOffset = (this.roadsideOffset + speed * 0.9 * dt) % (VIRTUAL_WIDTH * 1.5);
    this.roadOffset = (this.roadOffset + speed * dt) % 120; // Road dash repeats every 120px

    // Speed lines update
    for (const line of this.speedLines) {
      line.x -= line.speed * speedRatio * dt;
      if (line.x + line.length < 0) {
        line.x = VIRTUAL_WIDTH + Math.random() * 200;
        line.y = ROAD_TOP + 10 + Math.random() * (ROAD_BOTTOM - ROAD_TOP - 20);
        line.length = (Math.random() * 100 + 60) * (speedRatio > 1.2 ? 1.8 : 1);
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D, isFever: boolean, time: number) {
    // 1. Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    if (isFever) {
      skyGrad.addColorStop(0, '#23003b');
      skyGrad.addColorStop(0.5, '#400958');
      skyGrad.addColorStop(1, '#660b73');
    } else {
      skyGrad.addColorStop(0, '#090518');
      skyGrad.addColorStop(0.5, '#130d2d');
      skyGrad.addColorStop(1, '#251347');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, ROAD_TOP);

    // 2. Stars
    ctx.save();
    for (const star of this.starSeeds) {
      const twinkle = Math.sin(time * 3 + star.x) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * twinkle})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.restore();

    // 3. Cyber Moon
    ctx.save();
    const moonX = VIRTUAL_WIDTH - 180;
    const moonY = 85;
    ctx.shadowBlur = 35;
    ctx.shadowColor = isFever ? '#FF007F' : '#00F0FF';
    ctx.fillStyle = isFever ? '#FFB6E9' : '#DCF7FF';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 46, 0, Math.PI * 2);
    ctx.fill();

    // Pop-up book bold ring around moon
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#090518';
    ctx.stroke();

    // Neon rings across moon
    ctx.beginPath();
    ctx.ellipse(moonX, moonY, 72, 14, -0.3, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isFever ? 'rgba(255, 0, 128, 0.7)' : 'rgba(0, 240, 255, 0.7)';
    ctx.stroke();
    ctx.restore();

    // 4. Far Skyline
    this.drawFarSkyline(ctx, time, isFever);

    // 5. Mid Skyline
    this.drawMidSkyline(ctx, isFever);

    // 6. Roadside Props (Trees & Streetlights)
    this.drawRoadside(ctx, isFever);

    // 7. Road Surface & Markings
    this.drawRoad(ctx, isFever);

    // 8. Speed Lines
    this.drawSpeedLines(ctx, isFever);
  }

  private drawFarSkyline(ctx: CanvasRenderingContext2D, time: number, isFever: boolean) {
    ctx.save();
    for (const b of this.farBuildings) {
      // Loop wrapping
      const drawX = ((b.x - this.farOffset) % (VIRTUAL_WIDTH * 1.5)) - 100;
      if (drawX > VIRTUAL_WIDTH + 100 || drawX + b.width < -100) continue;

      const drawY = ROAD_TOP - b.height;

      // Pop-up style building silhouette
      ctx.fillStyle = b.color;
      ctx.fillRect(drawX, drawY, b.width, b.height);

      // Outline
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2b1b59';
      ctx.strokeRect(drawX, drawY, b.width, b.height);

      // Antenna
      if (b.hasAntenna) {
        ctx.beginPath();
        ctx.moveTo(drawX + b.width * 0.5, drawY);
        ctx.lineTo(drawX + b.width * 0.5, drawY - 25);
        ctx.strokeStyle = '#4e3391';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Blinking beacon
        const blink = Math.sin(time * 6 + b.x) > 0;
        if (blink) {
          ctx.fillStyle = '#FF2A4D';
          ctx.beginPath();
          ctx.arc(drawX + b.width * 0.5, drawY - 26, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Windows
      ctx.fillStyle = b.windowGlowColor;
      for (let r = 1; r < b.windowRows; r++) {
        for (let c = 1; c < b.windowCols; c++) {
          if ((r * 7 + c * 13 + b.x) % 5 === 0) continue; // Unlit windows
          ctx.fillRect(drawX + c * 14, drawY + r * 18, 6, 8);
        }
      }

      // Neon Sign
      if (b.neonSign) {
        ctx.save();
        ctx.font = 'bold 15px Jua, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 12;
        ctx.shadowColor = b.neonSign.color;
        ctx.fillStyle = b.neonSign.color;
        ctx.fillText(b.neonSign.text, drawX + b.width / 2, drawY + 22);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private drawMidSkyline(ctx: CanvasRenderingContext2D, isFever: boolean) {
    ctx.save();
    for (const b of this.midBuildings) {
      const drawX = ((b.x - this.midOffset) % (VIRTUAL_WIDTH * 1.5)) - 100;
      if (drawX > VIRTUAL_WIDTH + 100 || drawX + b.width < -100) continue;

      const drawY = ROAD_TOP - b.height;

      // Pop-up book drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = -4;

      ctx.fillStyle = b.color;
      ctx.fillRect(drawX, drawY, b.width, b.height);

      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;

      // Neon roof trim
      ctx.fillStyle = isFever ? '#FF007F' : '#00F0FF';
      ctx.fillRect(drawX, drawY, b.width, 3);

      // Windows grid
      ctx.fillStyle = isFever ? 'rgba(255, 100, 200, 0.35)' : 'rgba(0, 240, 255, 0.35)';
      for (let r = 1; r < b.windowRows; r++) {
        for (let c = 1; c < b.windowCols; c++) {
          if ((r * 11 + c * 17 + b.x) % 4 === 0) continue;
          ctx.fillRect(drawX + c * 16, drawY + r * 20, 7, 10);
        }
      }
    }
    ctx.restore();
  }

  private drawRoadside(ctx: CanvasRenderingContext2D, isFever: boolean) {
    ctx.save();
    // Trees (Pop-up neon foliage)
    for (const t of this.trees) {
      const drawX = ((t.x - this.roadsideOffset) % (VIRTUAL_WIDTH * 1.5)) - 80;
      if (drawX > VIRTUAL_WIDTH + 80 || drawX < -80) continue;

      const baseY = ROAD_TOP;

      // Trunk
      ctx.fillStyle = '#261942';
      ctx.fillRect(drawX - 4, baseY - t.height * 0.4, 8, t.height * 0.4);

      // Canopy
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowOffsetY = 6;
      ctx.shadowBlur = 6;

      ctx.fillStyle = isFever ? '#FF007F' : '#14C9A0';
      ctx.beginPath();
      ctx.arc(drawX, baseY - t.height * 0.65, t.height * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Bold outline
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0f0a21';
      ctx.stroke();
    }

    // Streetlights with light cones
    for (const light of this.streetlights) {
      const drawX = ((light.x - this.roadsideOffset) % (VIRTUAL_WIDTH * 1.5)) - 80;
      if (drawX > VIRTUAL_WIDTH + 80 || drawX < -80) continue;

      // Pole
      ctx.strokeStyle = '#4A3B72';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(drawX, ROAD_TOP);
      ctx.lineTo(drawX, ROAD_TOP - 90);
      ctx.lineTo(drawX + 30, ROAD_TOP - 95);
      ctx.stroke();

      // Lamp bulb
      const lampColor = isFever ? '#FF007F' : '#00F0FF';
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(drawX + 30, ROAD_TOP - 95, 5, 0, Math.PI * 2);
      ctx.fill();

      // Downward light cone onto road
      const coneGrad = ctx.createLinearGradient(drawX + 30, ROAD_TOP - 95, drawX + 30, ROAD_BOTTOM);
      coneGrad.addColorStop(0, isFever ? 'rgba(255, 0, 128, 0.25)' : 'rgba(0, 240, 255, 0.22)');
      coneGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(drawX + 30, ROAD_TOP - 95);
      ctx.lineTo(drawX + 110, ROAD_BOTTOM);
      ctx.lineTo(drawX - 50, ROAD_BOTTOM);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawRoad(ctx: CanvasRenderingContext2D, isFever: boolean) {
    ctx.save();

    // 1. Roadbed
    const roadGrad = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOTTOM);
    roadGrad.addColorStop(0, '#100D1C');
    roadGrad.addColorStop(0.5, '#171329');
    roadGrad.addColorStop(1, '#0C0A17');

    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, ROAD_TOP, VIRTUAL_WIDTH, ROAD_BOTTOM - ROAD_TOP);

    // 2. Curb Borders (Upper & Lower guardrail)
    const curbColor = isFever ? '#FF007F' : '#00F0FF';

    // Top Curb
    ctx.shadowBlur = 10;
    ctx.shadowColor = curbColor;
    ctx.fillStyle = curbColor;
    ctx.fillRect(0, ROAD_TOP - 4, VIRTUAL_WIDTH, 6);

    // Bottom Curb
    ctx.fillRect(0, ROAD_BOTTOM - 2, VIRTUAL_WIDTH, 8);
    ctx.shadowBlur = 0;

    // Guardrail chevron patterns (top & bottom edges)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for (let x = -this.roadOffset; x < VIRTUAL_WIDTH + 60; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, ROAD_TOP - 12);
      ctx.lineTo(x + 10, ROAD_TOP);
      ctx.moveTo(x, ROAD_BOTTOM);
      ctx.lineTo(x + 10, ROAD_BOTTOM + 12);
      ctx.stroke();
    }

    // 3. Center Lane Divider (Dashed glowing neon line)
    const dividerY = ROAD_TOP + LANE_HEIGHT;
    ctx.shadowBlur = isFever ? 18 : 12;
    ctx.shadowColor = isFever ? '#FFE600' : '#00F0FF';
    ctx.strokeStyle = isFever ? '#FFF176' : '#E0FBFF';
    ctx.lineWidth = 5;

    const dashLen = 50;
    const gapLen = 70;
    const totalCycle = dashLen + gapLen;

    for (let x = -this.roadOffset - totalCycle; x < VIRTUAL_WIDTH + totalCycle; x += totalCycle) {
      ctx.beginPath();
      ctx.moveTo(x, dividerY);
      ctx.lineTo(x + dashLen, dividerY);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // 4. Subtle road sheen
    const sheenGrad = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOTTOM);
    sheenGrad.addColorStop(0, 'rgba(0, 240, 255, 0.05)');
    sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    sheenGrad.addColorStop(1, 'rgba(255, 0, 128, 0.05)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, ROAD_TOP, VIRTUAL_WIDTH, ROAD_BOTTOM - ROAD_TOP);

    ctx.restore();
  }

  private drawSpeedLines(ctx: CanvasRenderingContext2D, isFever: boolean) {
    ctx.save();
    ctx.lineWidth = isFever ? 2.5 : 1.5;
    const lineColor = isFever ? '#FFE600' : '#00F0FF';

    for (const line of this.speedLines) {
      ctx.strokeStyle = lineColor;
      ctx.globalAlpha = isFever ? line.alpha * 1.8 : line.alpha;
      ctx.beginPath();
      ctx.moveTo(line.x, line.y);
      ctx.lineTo(line.x + line.length, line.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
