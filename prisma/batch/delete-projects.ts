import { PrismaClient } from "@prisma/client";
import { PROJECTS_METADATA } from "./seed-project";
const prisma = new PrismaClient();

async function main() {
  const slugs = PROJECTS_METADATA.map((p) => p.slug);
  const result = await prisma.project.deleteMany({
    where: { slug: { in: slugs } },
  });
  console.info(`${result.count} projects deleted.`);
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
