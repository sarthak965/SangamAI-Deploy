import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { CurrentUser } from "../types";
import { useTheme } from "../lib/theme";

/* ── constants ─────────────────────────────────────────────── */
const TAGLINE =
  "Slack for AI — collaborate with friends on projects over the same AI chat and shared context.";
const WORD_REVEAL_DELAY_MS = 100;

interface Feature {
  icon: string;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: "🤝",
    title: "Shared AI Rooms",
    description:
      "Create environments where your whole team talks to the same AI. Everyone sees the response stream live.",
  },
  {
    icon: "💬",
    title: "Paragraph Threads",
    description:
      "Click any paragraph in an AI response to start a focused discussion — like comments on Medium, but with AI.",
  },
  {
    icon: "🔐",
    title: "Host Controls",
    description:
      "The room host decides who can prompt the AI. Add members, assign co-hosts, and manage permissions.",
  },
];

/* ── word-by-word reveal hook ──────────────────────────────── */
function useWordReveal(text: string, delayMs: number) {
  const words = text.split(" ");
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= words.length) return;
    const timer = setTimeout(() => setVisibleCount((c) => c + 1), delayMs);
    return () => clearTimeout(timer);
  }, [visibleCount, words.length, delayMs]);

  return { words, visibleCount };
}

/* ── scroll observer hook ──────────────────────────────────── */
function useScrollVisible(
  ref: React.RefObject<HTMLElement | null>,
  threshold = 0.15,
) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);

  return visible;
}

/* ── component ─────────────────────────────────────────────── */
export default function LandingPage({
  currentUser,
}: {
  currentUser: CurrentUser | null;
  authLoading: boolean;
  authError: string | null;
  onAuthenticated: (auth: never) => void;
}) {
  const navigate = useNavigate();
  const featuresRef = useRef<HTMLDivElement | null>(null);
  const featureCardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [navScrolled, setNavScrolled] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  const { words, visibleCount } = useWordReveal(TAGLINE, WORD_REVEAL_DELAY_MS);
  const featuresVisible = useScrollVisible(featuresRef);

  /* redirect if already logged in */
  useEffect(() => {
    if (currentUser) navigate("/app", { replace: true });
  }, [currentUser, navigate]);

  /* navbar shadow on scroll */
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* staggered feature card reveal */
  const cardVisibility = FEATURES.map((_, i) => {
    const ref = useCallback(
      (node: HTMLDivElement | null) => {
        featureCardsRef.current[i] = node;
      },
      [i],
    );
    return { ref, visible: featuresVisible };
  });

  return (
    <div className="landing-page">
      {/* navbar */}
      <nav className={`landing-nav ${navScrolled ? "scrolled" : ""}`}>
        <div className="nav-brand">
          <div className="logo-icon">S</div>
          <span>SangamAI</span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            type="button"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/auth")}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* hero */}
      <section className="landing-hero">
        <div className="hero-logo">
          <div className="logo-icon">S</div>
          <span>SangamAI</span>
        </div>

        <h1 className="hero-title">SangamAI</h1>

        <p className="hero-tagline">
          {words.map((word, i) => (
            <span
              key={i}
              className={`word ${i < visibleCount ? "visible" : ""}`}
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              {word}{" "}
            </span>
          ))}
        </p>

        <div className="hero-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate("/auth")}
          >
            Start with SangamAI
          </button>
          <a href="#features" className="btn btn-ghost">
            Explore features ↓
          </a>
        </div>
      </section>

      {/* features */}
      <section className="landing-features" id="features" ref={featuresRef}>
        <h2
          className={`features-floating-title ${featuresVisible ? "visible" : ""}`}
        >
          Features of SangamAI
        </h2>

        <div className="features-grid">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className={`feature-card ${featuresVisible ? "visible" : ""}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
