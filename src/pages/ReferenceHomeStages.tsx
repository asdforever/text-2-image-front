import { useEffect, useRef } from "react";
/** 圆角矩形路径辅助 */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 一键成片银幕：舞台顶光明暗呼吸 + 尘埃 + 「点击式向导」场景。
 *  场景 = 迷你创作面板：输入框 → 步骤 1/2/3 → 开始生成按钮，
 *  一个点击光斑依次「点」过每一步，被点亮的步骤保持高亮。纯装饰。 */
export function AutoStage({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0, h = 0, dpr = 1;
    type P = { x: number; y: number; r: number; a: number; vx: number; vy: number; tw: number };
    let parts: P[] = [];
    const seed = () => {
      parts = [];
      const count = Math.min(46, Math.max(20, Math.floor((w * h) / 22000)));
      for (let i = 0; i < count; i++) {
        parts.push({
          x: Math.random() * w, y: Math.random() * h,
          r: 0.5 + Math.random() * 1.5,
          a: 0.04 + Math.random() * 0.12,
          vx: 0.03 + Math.random() * 0.08,
          vy: 0.04 + Math.random() * 0.11,
          tw: Math.random() * Math.PI * 2,
        });
      }
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reducedMotion) draw(0);
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      // 环境光：舞台顶光，明暗呼吸 + 光锥游移
      const breath = 0.55 + 0.45 * Math.sin(t / 4200);
      const sway = Math.sin(t / 6000) * 0.07;
      const cx = w * (0.5 + sway), cy = -h * 0.12;
      const bx = w * (0.42 + sway), by = h * 1.08;
      const g = ctx.createLinearGradient(cx, cy, bx, by);
      g.addColorStop(0, "rgba(255,246,232,0)");
      g.addColorStop(0.3, `rgba(255,244,228,${0.16 * breath})`);
      g.addColorStop(1, "rgba(255,244,228,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy); ctx.lineTo(cx + 30, cy);
      ctx.lineTo(bx + 240, by); ctx.lineTo(bx - 240, by);
      ctx.closePath(); ctx.fill();
      const g2 = ctx.createLinearGradient(0, h * 0.82, 0, h);
      g2.addColorStop(0, `rgba(255,244,228,${0.06 * breath})`);
      g2.addColorStop(1, "rgba(255,244,228,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, h * 0.8, w, h * 0.2);

      // 尘埃
      for (const p of parts) {
        const tw = Math.sin(t / 2400 + p.tw) * 0.5 + 0.5;
        ctx.globalAlpha = p.a * (0.35 + tw * 0.65);
        ctx.fillStyle = "#f4e8d8";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.y > h + 4) { p.y = -4; p.x = Math.random() * w; }
        if (p.x > w + 4) { p.x = -4; }
      }
      ctx.globalAlpha = 1;

      // 点击式向导场景：铺满卡片的大面板
      const sX = w * 0.1, sY = h * 0.08;
      const sW = w * 0.8, sH = h * 0.58;
      const panel = { x: sX, y: sY, w: sW, h: sH };
      const pg = ctx.createRadialGradient(panel.x + panel.w / 2, panel.y + panel.h * 0.4, 0, panel.x + panel.w / 2, panel.y + panel.h * 0.4, panel.w * 0.7);
      pg.addColorStop(0, `rgba(255,240,220,${0.05 * breath})`);
      pg.addColorStop(1, "rgba(255,240,220,0)");
      ctx.fillStyle = pg;
      ctx.fillRect(panel.x - panel.w * 0.1, panel.y - panel.h * 0.15, panel.w * 1.2, panel.h * 1.3);

      rr(ctx, panel.x, panel.y, panel.w, panel.h, 16);
      ctx.fillStyle = "rgba(10,10,13,0.62)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();

      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(panel.x + 22 + i * 16, panel.y + 18, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.4 - i * 0.08})`;
        ctx.fill();
      }

      // 输入框（一张图 + 一句话）
      const inY = panel.y + 40;
      const inH = panel.h * 0.17;
      rr(ctx, panel.x + 20, inY, panel.w - 40, inH, 9);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      rr(ctx, panel.x + 32, inY + inH / 2 - 2, panel.w * 0.42, 4, 2);
      ctx.fill();

      // 三个步骤
      const stepY = inY + inH + panel.h * 0.18;
      const stepR = 14;
      const stepXs = [
        panel.x + panel.w * 0.28,
        panel.x + panel.w * 0.5,
        panel.x + panel.w * 0.72,
      ];
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(stepXs[0] + stepR + 7, stepY);
      ctx.lineTo(stepXs[2] - stepR - 7, stepY);
      ctx.stroke();

      // 开始生成按钮
      const btnY = stepY + 44;
      const btnH = panel.h * 0.18;
      rr(ctx, panel.x + 20, btnY, panel.w - 40, btnH, 10);
      const bg = ctx.createLinearGradient(panel.x + 20, 0, panel.x + panel.w - 20, 0);
      bg.addColorStop(0, "rgba(255,214,150,0.85)");
      bg.addColorStop(1, "rgba(255,190,110,0.75)");
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,230,190,0.6)";
      ctx.stroke();
      ctx.fillStyle = "rgba(20,14,8,0.85)";
      ctx.font = "600 15px Inter, 'PingFang SC', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("开始生成", panel.x + panel.w / 2, btnY + btnH / 2 + 0.5);

      // 点击光斑：依次点 步骤1 → 步骤2 → 步骤3 → 生成按钮，循环
      const targets = [
        { x: stepXs[0], y: stepY, r: stepR + 10 },
        { x: stepXs[1], y: stepY, r: stepR + 10 },
        { x: stepXs[2], y: stepY, r: stepR + 10 },
        { x: panel.x + panel.w / 2, y: btnY + btnH / 2, r: btnH * 0.8 },
      ];
      const cycle = 4600;
      const ph = (t % cycle) / cycle;
      const seg = 1 / targets.length;
      const idx = Math.min(targets.length - 1, Math.floor(ph / seg));
      const local = (ph - idx * seg) / seg;
      const pulse = 1 - local;
      const tgt = targets[idx];
      ctx.save();
      ctx.globalAlpha = Math.max(0, pulse) * 0.9;
      ctx.beginPath();
      ctx.arc(tgt.x, tgt.y, tgt.r + 5 + (1 - pulse) * 26, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,220,165,0.9)";
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tgt.x, tgt.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,240,210,0.95)";
      ctx.fill();
      ctx.restore();

      // 步骤高亮
      for (let i = 0; i < 3; i++) {
        const done = i < idx;
        const active = i === idx;
        const a = active ? 0.95 : done ? 0.55 : 0.16;
        ctx.beginPath();
        ctx.arc(stepXs[i], stepY, stepR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,214,150,${a})`;
        ctx.fill();
        ctx.strokeStyle = active ? "rgba(255,240,210,0.9)" : "rgba(255,255,255,0.3)";
        ctx.stroke();
        ctx.fillStyle = active || done ? "rgba(20,14,8,0.85)" : "rgba(255,255,255,0.5)";
        ctx.font = "600 13px Inter, 'PingFang SC', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), stepXs[i], stepY + 0.5);
      }

      if (!reducedMotion) raf = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener("resize", resize);
    if (!reducedMotion) raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

/** 画布创作银幕：环境侧光明暗呼吸 + 尘埃 + 「节点连线图」场景。
 *  场景 = 4 个节点方块，贝塞尔连线，光点沿线流动，节点呼吸。纯装饰。 */
export function CanvasStage({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0, h = 0, dpr = 1;
    type P = { x: number; y: number; r: number; a: number; vx: number; vy: number; tw: number };
    let parts: P[] = [];
    const seed = () => {
      parts = [];
      const count = Math.min(34, Math.max(14, Math.floor((w * h) / 32000)));
      for (let i = 0; i < count; i++) {
        parts.push({
          x: Math.random() * w, y: Math.random() * h,
          r: 0.5 + Math.random() * 1.3,
          a: 0.035 + Math.random() * 0.1,
          vx: 0.02 + Math.random() * 0.06,
          vy: 0.03 + Math.random() * 0.08,
          tw: Math.random() * Math.PI * 2,
        });
      }
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reducedMotion) draw(0);
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      // 环境光：侧光，明暗呼吸 + 光向游移
      const breath = 0.55 + 0.45 * Math.sin(t / 5000 + 1.3);
      const sway = Math.sin(t / 7000) * 0.08;
      const lx = -w * 0.05, ly = -h * (0.06 + sway);
      const rx = w * (1.02 - sway), ry = h * 1.02;
      const g = ctx.createLinearGradient(lx, ly, rx, ry);
      g.addColorStop(0, `rgba(255,240,224,${0.14 * breath})`);
      g.addColorStop(0.45, `rgba(255,240,224,${0.055 * breath})`);
      g.addColorStop(1, "rgba(255,240,224,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const g2 = ctx.createRadialGradient(w * 0.82, h * 0.86, 0, w * 0.82, h * 0.86, Math.min(w, h) * 0.7);
      g2.addColorStop(0, `rgba(255,238,220,${0.06 * breath})`);
      g2.addColorStop(1, "rgba(255,238,220,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // 尘埃
      for (const p of parts) {
        const tw = Math.sin(t / 2800 + p.tw) * 0.5 + 0.5;
        ctx.globalAlpha = p.a * (0.35 + tw * 0.65);
        ctx.fillStyle = "#f2e6d6";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x > w + 4) { p.x = -4; }
        if (p.y > h + 4) { p.y = -4; }
      }
      ctx.globalAlpha = 1;

      // 节点连线图：铺满卡片的大图
      const cx0 = w * 0.08, cy0 = h * 0.16;
      const nodes = [
        { x: cx0, y: cy0, w: w * 0.12, h: h * 0.14, kind: "in" as const },
        { x: cx0 + w * 0.34, y: cy0 - h * 0.1, w: w * 0.1, h: h * 0.12, kind: "mid" as const },
        { x: cx0 + w * 0.34, y: cy0 + h * 0.2, w: w * 0.1, h: h * 0.12, kind: "mid" as const },
        { x: cx0 + w * 0.7, y: cy0 + h * 0.05, w: w * 0.13, h: h * 0.16, kind: "out" as const },
      ];
      const links: Array<[number, number]> = [[0, 1], [0, 2], [1, 3], [2, 3]];

      for (const [a, b] of links) {
        const A = nodes[a], B = nodes[b];
        const x1 = A.x + A.w, y1 = A.y + A.h / 2;
        const x2 = B.x, y2 = B.y + B.h / 2;
        const mx = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, y1, x2, y2);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const pt = (tt: number) => {
          const u = 1 - tt;
          return {
            x: u * u * x1 + 2 * u * tt * mx + tt * tt * x2,
            y: u * u * y1 + 2 * u * tt * y1 + tt * tt * y2,
          };
        };
        for (let k = 0; k < 2; k++) {
          const tt = (t / 2600 + k * 0.5 + a * 0.17) % 1;
          const P = pt(tt);
          ctx.beginPath();
          ctx.arc(P.x, P.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,216,160,0.85)";
          ctx.fill();
          const pg = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, 11);
          pg.addColorStop(0, "rgba(255,216,160,0.28)");
          pg.addColorStop(1, "rgba(255,216,160,0)");
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(P.x, P.y, 11, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const pulse = 0.75 + 0.25 * Math.sin(t / 3200 + i * 1.3);
        const isOut = n.kind === "out";
        rr(ctx, n.x, n.y, n.w, n.h, 9);
        ctx.fillStyle = "rgba(13,13,17,0.72)";
        ctx.fill();
        ctx.strokeStyle = isOut
          ? `rgba(255,206,140,${0.5 * pulse})`
          : `rgba(255,255,255,${0.24 * pulse})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = isOut ? "rgba(255,216,160,0.4)" : "rgba(255,255,255,0.14)";
        rr(ctx, n.x + n.w * 0.16, n.y + n.h * 0.3, n.w * 0.68, 3.5, 1.75);
        ctx.fill();
        if (n.h > h * 0.12) {
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          rr(ctx, n.x + n.w * 0.16, n.y + n.h * 0.58, n.w * 0.5, 3.5, 1.75);
          ctx.fill();
        }
        if (isOut) {
          const og = ctx.createRadialGradient(n.x + n.w / 2, n.y + n.h / 2, 0, n.x + n.w / 2, n.y + n.h / 2, n.w * 0.85);
          og.addColorStop(0, `rgba(255,206,140,${0.16 * pulse})`);
          og.addColorStop(1, "rgba(255,206,140,0)");
          ctx.fillStyle = og;
          ctx.fillRect(n.x - n.w * 0.4, n.y - n.h * 0.5, n.w * 1.8, n.h * 2);
        }
      }

      if (!reducedMotion) raf = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener("resize", resize);
    if (!reducedMotion) raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}


