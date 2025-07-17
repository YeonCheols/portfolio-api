import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const PROJECTS_METADATA = [
  {
    title: "포트폴리오 웹사이트",
    slug: "portfolio-website",
    description: "개인 포트폴리오 및 블로그 사이트입니다.",
    image:
      "https://ywlmykjlvcpfabodffof.supabase.co/storage/v1/object/public/portfolio-img/main/IMG_0370.webp",
    linkDemo: "https://myportfolio.com",
    linkGithub: "https://github.com/username/portfolio",
    stacks: '["React.js","Next.js","TailwindCSS","TypeScript"]',
    isShow: true,
    content:
      "이 프로젝트는 최신 웹 기술을 활용하여 제작된 개인 포트폴리오입니다.",
  },
  {
    title: "쇼핑몰 플랫폼",
    slug: "shopping-mall-platform",
    description: "중소상인을 위한 쇼핑몰 솔루션입니다.",
    image:
      "https://ywlmykjlvcpfabodffof.supabase.co/storage/v1/object/public/portfolio-img/main/IMG_0370.webp",
    linkDemo: "https://shopmall.com",
    linkGithub: "https://github.com/username/shopmall",
    stacks: '["Vue.js","Nuxt.js","Express","MySQL"]',
    isShow: true,
    content: "다양한 상점이 입점할 수 있는 쇼핑몰 플랫폼입니다.",
  },
  {
    title: "AI 챗봇 서비스",
    slug: "ai-chatbot-service",
    description: "고객 상담을 위한 AI 챗봇 서비스입니다.",
    image:
      "https://ywlmykjlvcpfabodffof.supabase.co/storage/v1/object/public/portfolio-img/main/IMG_0370.webp",
    linkDemo: "https://aichatbot.com",
    linkGithub: "https://github.com/username/aichatbot",
    stacks: '["Node.js","React.js","TensorFlow","Socket.io"]',
    isShow: false,
    content: "실시간 상담이 가능한 인공지능 챗봇 서비스입니다.",
  },
  {
    title: "블로그 플랫폼",
    slug: "blog-platform",
    description: "개인 및 팀 블로그 운영을 위한 플랫폼입니다.",
    image:
      "https://ywlmykjlvcpfabodffof.supabase.co/storage/v1/object/public/portfolio-img/main/IMG_0370.webp",
    linkDemo: "https://blogplatform.com",
    linkGithub: "https://github.com/username/blogplatform",
    stacks: '["Next.js","Prisma","PostgreSQL","TypeScript"]',
    isShow: true,
    content: "마크다운 기반의 블로그 작성과 팀 협업이 가능한 플랫폼입니다.",
  },
  {
    title: "이커머스 어드민 대시보드",
    slug: "ecommerce-admin-dashboard",
    description: "이커머스 운영자를 위한 어드민 대시보드입니다.",
    image:
      "https://ywlmykjlvcpfabodffof.supabase.co/storage/v1/object/public/portfolio-img/main/IMG_0370.webp",
    linkDemo: "https://ecommerceadmin.com",
    linkGithub: "https://github.com/username/ecommerceadmin",
    stacks: '["React.js","Redux","Material UI","Node.js"]',
    isShow: true,
    content:
      "상품, 주문, 회원, 통계 등 이커머스 운영에 필요한 기능을 제공합니다.",
  },
  {
    title: "실시간 채팅 서비스",
    slug: "realtime-chat-service",
    description: "웹 기반 실시간 채팅 서비스입니다.",
    image:
      "https://ywlmykjlvcpfabodffof.supabase.co/storage/v1/object/public/portfolio-img/main/IMG_0370.webp",
    linkDemo: "https://chatservice.com",
    linkGithub: "https://github.com/username/chatservice",
    stacks: '["Vue.js","Socket.io","Express","MongoDB"]',
    isShow: true,
    content:
      "다중 채널, 이모지, 파일 전송 등 다양한 기능을 지원하는 채팅 서비스입니다.",
  },
  {
    title: "포트폴리오 빌더",
    slug: "portfolio-builder",
    description: "개인 포트폴리오를 손쉽게 제작할 수 있는 빌더 서비스입니다.",
    image:
      "https://ywlmykjlvcpfabodffof.supabase.co/storage/v1/object/public/portfolio-img/main/IMG_0370.webp",
    linkDemo: "https://portfoliobuilder.com",
    linkGithub: "https://github.com/username/portfoliobuilder",
    stacks: '["Angular","Firebase","SCSS"]',
    isShow: false,
    content: "드래그 앤 드롭 방식으로 포트폴리오를 제작할 수 있습니다.",
  },
  {
    title: "캘린더 일정 관리 앱",
    slug: "calendar-scheduler-app",
    description: "일정 및 할일 관리를 위한 캘린더 앱입니다.",
    image:
      "https://ywlmykjlvcpfabodffof.supabase.co/storage/v1/object/public/portfolio-img/main/IMG_0370.webp",
    linkDemo: "https://calendarapp.com",
    linkGithub: "https://github.com/username/calendarapp",
    stacks: '["Svelte","Node.js","SQLite"]',
    isShow: true,
    content: "일정 등록, 반복 알림, 공유 기능을 제공하는 캘린더 앱입니다.",
  },
];

async function main() {
  for (const project of PROJECTS_METADATA) {
    await prisma.project.upsert({
      where: { slug: project.slug },
      update: project,
      create: project,
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
