import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const STACKS_METADATA = [
  { name: "PHP", icon: "SiPhp", color: "text-blue-500", category: "backend" },
  {
    name: "JavaScript",
    icon: "SiJavascript",
    color: "text-yellow-400",
    category: "frontend",
  },
  {
    name: "TypeScript",
    icon: "SiTypescript",
    color: "text-blue-400",
    category: "frontend",
  },
  { name: "Next.js", icon: "SiNextdotjs", color: "", category: "frontend" },
  {
    name: "React.js",
    icon: "SiReact",
    color: "text-sky-500",
    category: "frontend",
  },
  {
    name: "TailwindCSS",
    icon: "SiTailwindcss",
    color: "text-cyan-300",
    category: "frontend",
  },
  {
    name: "Bootstrap",
    icon: "BsFillBootstrapFill",
    color: "text-purple-500",
    category: "frontend",
  },
  {
    name: "GraphQL",
    icon: "SiGraphql",
    color: "text-pink-600",
    category: "backend",
  },
  { name: "Apollo", icon: "SiApollographql", color: "", category: "backend" },
  { name: "WordPress", icon: "SiWordpress", color: "", category: "backend" },
  {
    name: "Laravel",
    icon: "SiLaravel",
    color: "text-red-500",
    category: "backend",
  },
  {
    name: "Material UI",
    icon: "SiMui",
    color: "text-sky-400",
    category: "frontend",
  },
  { name: "Vite", icon: "SiVite", color: "text-purple-500", category: "tool" },
  {
    name: "Prisma",
    icon: "SiPrisma",
    color: "text-emerald-500",
    category: "database",
  },
  {
    name: "Firebase",
    icon: "SiFirebase",
    color: "text-yellow-500",
    category: "backend",
  },
  {
    name: "Artificial Intelligence",
    icon: "BsRobot",
    color: "text-rose-500",
    category: "other",
  },
  {
    name: "Angular",
    icon: "SiAngular",
    color: "text-red-500",
    category: "frontend",
  },
  {
    name: "Vue.js",
    icon: "SiVuedotjs",
    color: "text-green-500",
    category: "frontend",
  },
  {
    name: "Nuxt.js",
    icon: "SiNuxtdotjs",
    color: "text-green-400",
    category: "frontend",
  },
  {
    name: "Node.js",
    icon: "SiNodedotjs",
    color: "text-green-600",
    category: "backend",
  },
  {
    name: "Gatsby",
    icon: "SiGatsby",
    color: "text-purple-600",
    category: "frontend",
  },
  {
    name: "Redux",
    icon: "SiRedux",
    color: "text-purple-500",
    category: "frontend",
  },
  {
    name: "Webpack",
    icon: "SiWebpack",
    color: "text-blue-500",
    category: "tool",
  },
  {
    name: "Styled Components",
    icon: "SiStyledcomponents",
    color: "text-pink-500",
    category: "frontend",
  },
  { name: "PWA", icon: "SiPwa", color: "text-amber-600", category: "frontend" },
  {
    name: "Nginx",
    icon: "SiNginx",
    color: "text-green-500",
    category: "devops",
  },
  { name: "Jest", icon: "SiJest", color: "text-red-600", category: "tool" },
  {
    name: "Storybook",
    icon: "SiStorybook",
    color: "text-amber-500",
    category: "tool",
  },
  { name: "CSS", icon: "SiCss3", color: "text-blue-300", category: "frontend" },
  { name: "Socket", icon: "SiSocketdotio", color: "", category: "backend" },
  { name: "Express", icon: "SiExpress", color: "", category: "backend" },
  { name: "Jquery", icon: "SiJquery", color: "", category: "frontend" },
  {
    name: "Scss",
    icon: "FaSass",
    color: "text-pink-500",
    category: "frontend",
  },
];

async function main() {
  for (const stack of STACKS_METADATA) {
    await prisma.tag.upsert({
      where: { name: stack.name },
      update: stack,
      create: stack,
    });
  }
}

main()
  .catch((e) => {
    console.info(e);
    process.exit(1);
  })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .finally(async () => {
    await prisma.$disconnect();
  });
