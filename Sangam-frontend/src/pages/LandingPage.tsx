import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import type { CurrentUser } from "../types";

const ICON_FLOW = ["<>", "+", "@", "[]", "{ }", "AI", "//", "#", "*", "->"];

const heroVariant = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariant = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

function StoryImageReveal() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "center center", "end start"],
  });

  const clipPath = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [
      "inset(24% 18% 20% 18% round 40px)",
      "inset(0% 0% 0% 0% round 28px)",
      "inset(24% 18% 20% 18% round 40px)",
    ],
  );
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.92, 1, 0.92]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.08, 1, 1.08]);
  const shadeOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.45, 0, 0.45]);
  const frameOpacity = useTransform(scrollYProgress, [0, 0.16, 0.84, 1], [0.2, 1, 1, 0.2]);

  return (
    <section id="story-image" ref={sectionRef} className="story-image-section">
      <motion.div
        className="story-image-cavern"
        style={{
          clipPath,
          scale,
          opacity: frameOpacity,
        }}
      >
        <motion.div className="story-image-shade" style={{ opacity: shadeOpacity }} />
        <div className="story-image-frame">
          <motion.img
            src="/placeholder.png"
            alt="SangamAI workspace preview"
            style={{ scale: imageScale }}
          />
        </div>
      </motion.div>
    </section>
  );
}

export default function LandingPage({
  currentUser,
}: {
  currentUser: CurrentUser | null;
  authLoading: boolean;
  authError: string | null;
  onAuthenticated: (auth: never) => void;
}) {
  const navigate = useNavigate();
  const [navScrolled, setNavScrolled] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (currentUser) {
      navigate("/app", { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-page landing-story-page">
      <nav className={`landing-nav landing-story-nav ${navScrolled ? "scrolled" : ""}`}>
        <div className="nav-brand">
          <div className="logo-icon">S</div>
          <span>SangamAI</span>
        </div>
        <div className="nav-links">
          <button type="button" className="landing-nav-link" onClick={() => scrollToSection("story-image")}>
            Workspace
          </button>
          <button type="button" className="landing-nav-link" onClick={() => scrollToSection("story-features")}>
            Features
          </button>
          <button type="button" className="landing-nav-link" onClick={() => scrollToSection("story-final")}>
            Teams
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/auth")}>
            Get Started
          </button>
        </div>
      </nav>

      <section className="story-hero">
        <motion.div
          className="story-hero-inner"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div className="story-kicker" variants={heroVariant}>
            SangamAI
          </motion.div>
          <motion.h1 variants={heroVariant}>Collaborate with AI. Together.</motion.h1>
          <motion.p className="story-hero-copy" variants={heroVariant}>
            Slack for AI - work with your friends on shared AI chats, projects, and
            context.
          </motion.p>
          <motion.div className="story-hero-actions" variants={heroVariant}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate("/auth")}>
              Start with SangamAI
            </button>
          </motion.div>
        </motion.div>
      </section>

      <StoryImageReveal />

      <section className="story-icon-section">
        <div className="story-icon-track">
          {ICON_FLOW.map((icon, index) => (
            <div
              key={`${icon}-${index}`}
              className="story-icon-node"
              style={{ animationDelay: `${index * 0.14}s` }}
            >
              <span>{icon}</span>
            </div>
          ))}
        </div>
      </section>

      <motion.section
        className="story-description-section"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.3 }}
      >
        <div className="story-description-copy">
          <p className="story-description-lead">SangamAI is Slack for AI users.</p>
          <p className="story-description-body">
            A shared workspace where conversations, context, and intelligence stay
            connected.
          </p>
        </div>
      </motion.section>

      <motion.section
        id="story-features"
        className="story-features-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.22 }}
        variants={staggerContainer}
      >
        <div className="story-section-head">
          <span>Core collaboration features</span>
          <h2>The best part of SangamAI is collaborative AI conversation</h2>
        </div>

        <div className="story-features-grid">
          <motion.article
            className="story-feature-card story-feature-card-spotlight"
            variants={cardVariant}
            whileHover={{ y: -5 }}
          >
            <div className="story-feature-spotlight-copy">
              <span className="story-feature-pill">Signature experience</span>
              <h3>Collaborative AI conversations</h3>
              <p className="story-feature-spotlight-lead">
                Reply to AI responses, open threaded discussions, and explore one
                idea from multiple angles with your team in the same shared space.
              </p>
            </div>
            <p>
              This is where SangamAI becomes different from a normal chat app. The
              conversation stays connected, shared, and alive for everyone involved.
            </p>
            <div className="story-feature-media">
              <video
                src="/video3.mp4"
                aria-label="Collaborative AI conversations preview"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
          </motion.article>
        </div>
      </motion.section>

      <motion.section
        id="story-final"
        className="story-final-cta"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.3 }}
      >
        <div className="story-final-column">
          <span className="story-final-badge">For developers</span>
          <h2>Achieve new heights</h2>
          <button className="btn btn-primary btn-lg" onClick={() => navigate("/auth")}>
            Start with SangamAI
          </button>
        </div>
      </motion.section>

      <motion.section
        className="story-brand-end"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.45 }}
        transition={{ duration: 0.3 }}
      >
        <h2>SangamAI</h2>
      </motion.section>
    </div>
  );
}
