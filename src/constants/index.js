import {
  mobile,
  backend,
  web,
  javascript,
  typescript,
  reactjs,
  nodejs2,
  python,
  go,
  rust,
  pytorch,
  opencv,
  docker,
  aws,
  ai1,
  webdev1,
  brain,
  zerovault,
  clankercode,
  swipr,
  steamanalysis,
  amazondeals,
} from "../assets";

export const navLinks = [
  {
    id: "about",
    title: "About",
  },
  {
    id: "work",
    title: "Work",
  },
  {
    id: "contact",
    title: "Contact",
  },
];

const services = [
  {
    title: "ML / Computer Vision Engineer",
    icon: brain,
  },
  {
    title: "Full-Stack Developer",
    icon: web,
  },
  {
    title: "Backend Engineer",
    icon: backend,
  },
  {
    title: "Mobile Developer",
    icon: mobile,
  },
];

const technologies = [
  { name: "Python", icon: python },
  { name: "TypeScript", icon: typescript },
  { name: "JavaScript", icon: javascript },
  { name: "Go", icon: go },
  { name: "Rust", icon: rust },
  { name: "PyTorch", icon: pytorch },
  { name: "OpenCV", icon: opencv },
  { name: "React", icon: reactjs },
  { name: "Node.js", icon: nodejs2 },
  { name: "Docker", icon: docker },
  { name: "AWS", icon: aws },
];

const experiences = [
  {
    title: "Machine Learning Research Assistant",
    company_name: "Center of Diagnostic Imaging Research (CDIR) · Windsor, ON",
    icon: ai1,
    iconBg: "#383E56",
    date: "Sep 2026 - Present",
    points: [
      "Developing an AI-driven, fully automated process monitoring system for dissimilar-material resistance spot riveted joints.",
      "Collecting process data from RIWA riveting machines and labelling it to build machine learning and computer vision training datasets.",
      "Training deep learning models in Python with PyTorch and OpenCV to detect welds, and visualizing results with Matplotlib and SciPy.",
      "Building models that classify weld quality as good or bad and generate an automated quality analysis report for each joint.",
    ],
  },
  {
    title: "Founding Engineer",
    company_name: "YAP Technologies Inc. · Remote",
    icon: mobile,
    iconBg: "#383E56",
    date: "Aug 2025 - Mar 2026",
    points: [
      "Built a real-time voice pipeline integrating Azure Speech, OpenAI, ElevenLabs and LiveKit with replies under 300ms.",
      "Shipped the iOS/Android app in React Native and TypeScript on a Node.js backend, reaching 3.5k users across 5 languages.",
      "Delivered same-day over-the-air bug fixes serving 100+ concurrent users.",
      "Set up CI/CD with GitHub Actions and Docker, plus Vitest, Playwright and Sentry, holding 99.9% uptime.",
    ],
  },
  {
    title: "Software Engineer Intern (Co-op)",
    company_name: "Vista (Cimpress) · Remote",
    icon: webdev1,
    iconBg: "#383E56",
    date: "Apr 2024 - Jun 2026",
    points: [
      "Built a domain-specific language and compiler with ANTLR to automate print template management, cutting design tickets by 60%.",
      "Shipped a REST API and live renderer over JSON/HTTP that let 30+ non-technical staff edit templates without a developer.",
      "Built Radius, a FastAPI marketplace where plants bid on print orders in timed rounds, plus the AI agent that bids to fill press runs.",
      "Tuned the ML agent's decisions over 40+ features in scikit-learn (inventory, location, eco practices), cutting ops time by 25%.",
      "Deployed services on AWS ECS Fargate (Docker, CloudWatch), gating GitHub Actions releases with Pytest to cut failed deploys by 15%.",
    ],
  },
];

const projects = [
  {
    name: "ZeroVault",
    description:
      "Zero-knowledge, end-to-end encrypted password manager. Argon2id + AES-256-GCM run client-side so the server never sees plaintext. Web app, browser extension and Rust (Tauri) desktop clients share one TypeScript core on a Go API, with 500+ tests.",
    tags: [
      { name: "typescript", color: "blue-text-gradient" },
      { name: "go", color: "green-text-gradient" },
      { name: "rust-tauri", color: "pink-text-gradient" },
    ],
    image: zerovault,
    source_code_link: "https://zerovault-teal.vercel.app",
    is_live_site: true,
  },
  {
    name: "Clanker Code",
    description:
      "Open-source CLI (on npm as clanker-code) that configures any repo for AI coding assistants like Claude Code: 26 commands, 46 skills, curated agents, MCPs and hooks. Tested on a 9-way GitHub Actions matrix (Node 18/20/22 x Linux/macOS/Windows), with a merge engine that preserves your edits.",
    tags: [
      { name: "typescript", color: "blue-text-gradient" },
      { name: "nodejs", color: "green-text-gradient" },
      { name: "cli", color: "pink-text-gradient" },
    ],
    image: clankercode,
    source_code_link: "https://github.com/UmayerK/clanker-code",
  },
  {
    name: "Swipr",
    description:
      "Landing page for a 'Tinder for jobs' app: a React + three.js (React Three Fiber) hero of fanned 3D job cards, GSAP/Lenis scrolling and a Framer Motion swipe-to-apply demo.",
    tags: [
      { name: "react", color: "blue-text-gradient" },
      { name: "threejs", color: "green-text-gradient" },
      { name: "gsap", color: "pink-text-gradient" },
    ],
    image: swipr,
    source_code_link: "https://github.com/UmayerK/swipr",
  },
  {
    name: "Steam Sentiment Analyzer",
    description:
      "Next.js 15 + TypeScript app that analyzes the sentiment of Steam game reviews using NLP (Sentiment.js) and the Steam API.",
    tags: [
      { name: "nextjs", color: "blue-text-gradient" },
      { name: "typescript", color: "green-text-gradient" },
      { name: "nlp", color: "pink-text-gradient" },
    ],
    image: steamanalysis,
    source_code_link: "https://github.com/UmayerK/steam-analysis",
  },
  {
    name: "Amazon Deal Evaluator",
    description:
      "Flask + Plotly dashboard that scores Amazon deals by comparing the actual discount to the discount predicted by a scikit-learn HistGradientBoostingRegressor trained on a 2.1M-product dataset.",
    tags: [
      { name: "python", color: "blue-text-gradient" },
      { name: "flask", color: "green-text-gradient" },
      { name: "scikit-learn", color: "pink-text-gradient" },
    ],
    image: amazondeals,
    source_code_link: "https://github.com/UmayerK/AmazonMLAnalysis",
  },
];

export { services, technologies, experiences, projects };
