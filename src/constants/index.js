import {
  mobile,
  backend,
  web,
  javascript,
  html,
  css,
  reactjs,
  tailwind,
  nodejs2,
  git,
  python,
  energy1,
  ai1,
  webdev1,
  security1,
  brain,
  threejswp,
  reactandthreewp,
  threejs2,
  vuejs,
  firebase,
  formulae,
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
    title: "Web Developer",
    displayTitle: "Web Developer",
    icon: web,
  },
  {
    title: "Open Source Developer",
    displayTitle: "Software Engineer", 
    icon: mobile,
  },
  {
    title: "Backend Developer",
    displayTitle: "Backend Developer",
    icon: backend,
  },
  {
    title: "AI / Machine Learning Developer",
    displayTitle: "AI / Machine Learning Developer",
    icon: brain,
  },
];

const technologies = [
  {
    name: "HTML 5",
    icon: html,
  },
  {
    name: "CSS 3",
    icon: css,
  },
  {
    name: "JavaScript",
    icon: javascript,
  },
  {
    name: "React JS",
    icon: reactjs,
  },
  {
    name: "Tailwind CSS",
    icon: tailwind,
  },
  {
    name: "nodejs2",
    icon: nodejs2,
  },
  {
    name: "git",
    icon: git,
  },
  {
    name: "python",
    icon: python,
  },
  {
    name: "threejs2",
    icon: threejs2,
  },
  {
    name: "firebase",
    icon: firebase,
  },
  {
    name: "vuejs",
    icon: vuejs,
  },
];

const experiences = [
  {
    title: "Software Enginner Intern",
    icon: webdev1,
    iconBg: "#383E56",
    date: "April 2024 - Present",
    points: [
      " Led the development of a scalable backend distribution network using the MCP schema, handling thousands of orders daily and ensuring scalability with MongoDB for real-time order information.",
      " Designed and implemented a seamless user interface with the MERN stack, significantly increasing user engagementthrough a streamlined and intuitive experience. The frontend was optimized for performance, leading to a 25% increase in user retention",
      " Developed and deployed machine learning models using historical data and advanced Python libraries such as PyTorch,scikit-learn, TensorFlow, and pandas. These models were crucial for parsing large datasets, optimizing resource allocation, and improving predictive analytics, whic",
    ],
  },
  {
    title: "Freelance Web Developer",
    icon: ai1,
    iconBg: "#383E56",
    date: " Dec 2023 - Present",
    points: [
      "Developed responsive and user-friendly websites using modern frameworks like React and Vue.js, ensuring cross-browser compatibility and optimal performance.",
      "Implemented custom e-commerce solutions with secure payment gateways, enhancing online sales capabilities for small businesses.",
      "Collaborated with designers to create visually appealing and intuitive user interfaces, improving overall user experience and engagement metrics.",
    ],
  },
];

const projects = [
  {
    name: "Safebook Anti Scam AI",
    description:
      "Safebook Anti Scam AI is a web app that uses AI to detect and prevent scams in real time allowing users to input a message and recieve a likelihood of it being a scam",
    tags: [
      {
        name: "react",
        color: "blue-text-gradient",
      },
      {
        name: "python",
        color: "green-text-gradient",
      },
      {
        name: "fastapi",
        color: "pink-text-gradient",
      },
    ],
    image: threejswp,
    source_code_link: "https://github.com/UmayerK/Winhacks2024-umayer",
  },
  {
    name: "Personal Portfolio Website",
    description:
      "Personal Portfolio Website made to showcase my progression as a software engineer you might just be looking at it right now ",
    tags: [
      {
        name: "react",
        color: "blue-text-gradient",
      },
      {
        name: "tailwind",
        color: "green-text-gradient",
      },
      {
        name: "3js",
        color: "pink-text-gradient",
      },
    ],
    image: reactandthreewp,
    source_code_link: "https://umayer.ca",
  },
  {
    name: "FSAE Formula Electric Race Car Display",
    description:
        "Contributed to the development of a low-level program for a Formula Electric race car, converting assembly code to C code.",
      tags: [
      {
        name: "c",
        color: "blue-text-gradient",
      },
      {
        name: "assembly",
        color: "green-text-gradient",
      },
      {
        name: "lowlevelprogramming",
        color: "pink-text-gradient",
      },
    ],
    image: formulae,
    source_code_link: "https://github.com/",
  },
 
];

export { services, technologies, experiences, projects };
