export interface ReportCardData {
  monthName: string;
  totalSpent: number;
  totalIncome: number;
  financialScore: number;
  grade: string;
  streakCount: number;
  savingsRate: number;
}

export class ReportCardCanvas {
  /**
   * Generates a premium 1080x1920px (standard Story aspect ratio) PNG image of the user's monthly report card.
   */
  static async generateStoryPng(data: ReportCardData): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not obtain 2D canvas context');

    // 1. Draw Deep Violet-Indigo Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGrad.addColorStop(0, '#0F0A1C');
    bgGrad.addColorStop(0.5, '#0B0F1A');
    bgGrad.addColorStop(1, '#050508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Draw Decorative Ambient Glow Circles
    ctx.save();
    // Indigo top glow
    const indigoGlow = ctx.createRadialGradient(540, 100, 0, 540, 100, 600);
    indigoGlow.addColorStop(0, 'rgba(124, 92, 252, 0.25)');
    indigoGlow.addColorStop(1, 'rgba(124, 92, 252, 0)');
    ctx.fillStyle = indigoGlow;
    ctx.beginPath();
    ctx.arc(540, 100, 600, 0, Math.PI * 2);
    ctx.fill();

    // Cyan bottom glow
    const cyanGlow = ctx.createRadialGradient(800, 1600, 0, 800, 1600, 500);
    cyanGlow.addColorStop(0, 'rgba(45, 212, 191, 0.15)');
    cyanGlow.addColorStop(1, 'rgba(45, 212, 191, 0)');
    ctx.fillStyle = cyanGlow;
    ctx.beginPath();
    ctx.arc(800, 1600, 500, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Draw Grid/Pattern overlay
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < 1080; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1920);
      ctx.stroke();
    }
    for (let y = 0; y < 1920; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1080, y);
      ctx.stroke();
    }
    ctx.restore();

    // Helper to format currency
    const formatINR = (val: number) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(val);
    };

    // 4. Header Text
    ctx.fillStyle = '#7C5CFC';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '6px';
    ctx.fillText('SMART SPEND AI', 540, 200);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '0.5px';
    ctx.fillText('Monthly Financial Report', 540, 290);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(`PROTOCOL LOG • ${data.monthName.toUpperCase()}`, 540, 360);

    // 5. Drawing Card Container for Score
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, 140, 430, 800, 480, 40);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Circular Score Gauge inside card
    const scoreColor = data.financialScore >= 80 ? '#2ED573' : data.financialScore >= 50 ? '#F5A623' : '#FF4757';
    ctx.save();
    ctx.translate(540, 640);
    // Draw background track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(0, 0, 140, 0, Math.PI * 2);
    ctx.stroke();

    // Draw active progress
    ctx.strokeStyle = scoreColor;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 20;
    ctx.shadowColor = scoreColor;
    ctx.beginPath();
    const endAngle = (data.financialScore / 100) * Math.PI * 2 - Math.PI / 2;
    ctx.arc(0, 0, 140, -Math.PI / 2, endAngle);
    ctx.stroke();
    ctx.restore();

    // Score Value inside circle
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 96px sans-serif';
    ctx.fillText(String(data.financialScore), 540, 665);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('HEALTH SCORE', 540, 715);

    ctx.fillStyle = scoreColor;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(data.grade.toUpperCase(), 540, 850);

    // 6. Stats Grid Layout
    const statCards = [
      { label: 'TOTAL SPENT', val: formatINR(data.totalSpent), color: '#FF4757' },
      { label: 'TOTAL INCOME', val: formatINR(data.totalIncome), color: '#2ED573' },
      { label: 'SAVINGS RATE', val: `${data.savingsRate}%`, color: '#7C5CFC' },
      { label: 'LOGGING STREAK', val: `${data.streakCount} Days`, color: '#4F8EF7' }
    ];

    statCards.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 140 + col * 420;
      const y = 970 + row * 340;

      // Draw mini cards
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, x, y, 380, 280, 32);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Top color indicator bar
      ctx.fillStyle = c.color;
      ctx.fillRect(x + 40, y + 248, 80, 6);

      // Label text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(c.label, x + 40, y + 60);

      // Value text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 48px sans-serif';
      ctx.fillText(c.val, x + 40, y + 130);
    });

    // 7. Footer Brand stamp
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN & TRACK VIA DEEP FINANCE AUTOMATIONS', 540, 1690);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SMARTSPEND.AI', 540, 1740);

    return canvas.toDataURL('image/png');
  }

  // Polyfill-like round rect drawer
  private static roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
