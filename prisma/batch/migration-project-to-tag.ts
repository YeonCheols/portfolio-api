import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateStacksToProjectTags() {
  try {
    console.info("🚀 Starting migration of stacks to ProjectTag table...");

    // 모든 프로젝트 조회
    const projects = await prisma.project.findMany({
      where: {
        isShow: true,
      },
    });

    console.info(`📊 Found ${projects.length} projects to migrate`);

    for (const project of projects) {
      try {
        // stacks JSON 파싱
        const stacks = JSON.parse(project.stacks) as string[];
        console.info(
          `📝 Processing project: ${project.title} with stacks: ${stacks.join(", ")}`,
        );

        // 각 스택에 대해 태그 찾기 또는 생성
        for (const stackName of stacks) {
          // 태그가 존재하는지 확인
          let tag = await prisma.tag.findUnique({
            where: { name: stackName },
          });

          // 태그가 없으면 생성
          if (!tag) {
            console.info(`🏷️  Creating new tag: ${stackName}`);
            tag = await prisma.tag.create({
              data: {
                name: stackName,
                icon: "default-icon", // 기본값
                color: "#000000", // 기본값
                category: "technology", // 기본값
              },
            });
          }

          // ProjectTag 관계 생성 (중복 방지)
          const existingRelation = await prisma.projectTag.findUnique({
            where: {
              projectId_tagId: {
                projectId: project.id,
                tagId: tag.id,
              },
            },
          });

          if (!existingRelation) {
            await prisma.projectTag.create({
              data: {
                projectId: project.id,
                tagId: tag.id,
              },
            });
            console.info(
              `✅ Created relation: ${project.title} <-> ${tag.name}`,
            );
          } else {
            console.info(
              `⏭️  Relation already exists: ${project.title} <-> ${tag.name}`,
            );
          }
        }
      } catch (error) {
        console.warn(`❌ Error processing project ${project.title}:`, error);
      }
    }

    console.info("🎉 Migration completed successfully!");
  } catch (error) {
    console.warn("❌ Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
void migrateStacksToProjectTags();
