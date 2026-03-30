import { useEffect, useRef } from "react";

/* ── config ────────────────────────────────────────────────── */
const STAR_COUNT = 180;
const STAR_MAX_RADIUS = 2;
const PARALLAX_FACTOR = 0.03;

/* ── star type ─────────────────────────────────────────────── */
interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  drift: number;
  depth: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

function createStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: 0.3 + Math.random() * STAR_MAX_RADIUS,
    alpha: 0.3 + Math.random() * 0.7,
    drift: 0.00002 + Math.random() * 0.00008,
    depth: Math.random(),
    twinkleSpeed: 0.5 + Math.random() * 2,
    twinkleOffset: Math.random() * Math.PI * 2,
  }));
}

/**
 * Full-screen starfield canvas that sits behind all content.
 * Stars drift upward, parallax-shift with cursor, and twinkle.
 * Adapts to light/dark theme automatically.
 */
export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const stars = useRef<Star[]>(createStars(STAR_COUNT));
  const t0 = useRef(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      mouse.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", onMove);

    let raf: number;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const elapsed = (Date.now() - t0.current) / 1000;
      const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";

      ctx.clearRect(0, 0, w, h);

      const mx = (mouse.current.x - 0.5) * 2;
      const my = (mouse.current.y - 0.5) * 2;

      for (const star of stars.current) {
        /* slow upward drift */
        star.y -= star.drift;
        if (star.y < -0.05) star.y = 1.05;

        /* parallax */
        const px = star.x * w + mx * star.depth * w * PARALLAX_FACTOR;
        const py = star.y * h + my * star.depth * h * PARALLAX_FACTOR;

        /* twinkle */
        const twinkle =
          0.5 + 0.5 * Math.sin(elapsed * star.twinkleSpeed + star.twinkleOffset);
        const alpha = star.alpha * (0.4 + 0.6 * twinkle);

        const color = isDark
          ? `rgba(255, 255, 255, ${alpha})`
          : `rgba(0, 0, 0, ${alpha * 0.2})`;

        ctx.beginPath();
        ctx.arc(px, py, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        /* glow halo for bright stars in dark mode */
        if (isDark && star.radius > 1.2 && alpha > 0.6) {
          ctx.beginPath();
          ctx.arc(px, py, star.radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 200, 150, ${alpha * 0.08})`;
          ctx.fill();
        }
      }

      /* subtle nebula glow near cursor (dark mode only) */
      if (isDark) {
        const gx = mouse.current.x * w;
        const gy = mouse.current.y * h;
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 250);
        grad.addColorStop(0, "rgba(255, 107, 0, 0.03)");
        grad.addColorStop(1, "rgba(255, 107, 0, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield-canvas" />;
}
