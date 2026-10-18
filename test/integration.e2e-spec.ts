import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import * as request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

describe("테스트 DB 통합", () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
    await prisma.projectTag.deleteMany();
    await prisma.project.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.profile.deleteMany();

    const tag = await prisma.tag.create({
      data: {
        name: "Jest",
        icon: "icon",
        color: "#000000",
        category: "technology",
      },
    });
    const project = await prisma.project.create({
      data: {
        title: "통합 샘플",
        slug: "integration-sample",
        description: "통합 테스트용",
        image: "https://example.com/project.png",
        stacks: "[]",
        isShow: true,
        content: "본문",
      },
    });
    await prisma.project.create({
      data: {
        title: "숨김",
        slug: "integration-hidden",
        description: "숨김",
        image: "https://example.com/hidden.png",
        stacks: "[]",
        isShow: false,
      },
    });
    await prisma.projectTag.create({
      data: { projectId: project.id, tagId: tag.id },
    });
    await prisma.profile.create({
      data: {
        name: "통합테스트",
        imageUrl: "https://example.com/profile.png",
        isActive: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("GET /health는 200과 status ok를 반환한다", () => {
    return request(app.getHttpServer())
      .get("/health")
      .expect(200)
      .expect({ status: "ok" });
  });

  it("DB에 연결되면 GET /health/db는 200과 db up을 반환한다", async () => {
    const response = await request(app.getHttpServer())
      .get("/health/db")
      .expect(200);

    expect(response.body).toEqual({
      status: "ok",
      db: "up",
      latencyMs: expect.any(Number),
    });
  });

  it("활성 프로필을 조회하면 테스트 DB의 이름을 반환한다", async () => {
    const response = await request(app.getHttpServer())
      .get("/profile")
      .expect(200);

    expect(response.body.name).toBe("통합테스트");
  });

  it("공개 프로젝트 목록은 보이는 글만 반환한다", async () => {
    const response = await request(app.getHttpServer())
      .get("/project")
      .expect(200);

    const slugs = response.body.map(
      (project: { slug: string }) => project.slug,
    );
    expect(slugs).toContain("integration-sample");
    expect(slugs).not.toContain("integration-hidden");
  });

  it("태그 목록은 연결된 공개 프로젝트 수를 반환한다", async () => {
    const response = await request(app.getHttpServer()).get("/tag").expect(200);

    const tag = response.body.find(
      (item: { name: string }) => item.name === "Jest",
    );
    expect(tag.projectCount).toBe(1);
  });

  it("DB에 연결할 수 없으면 GET /health/db는 503을 반환한다", async () => {
    const previousUrl = process.env.DATABASE_URL;
    const previousDirectUrl = process.env.DATABASE_DIRECT_URL;
    const unreachable = "postgresql://test:test@127.0.0.1:1/portfolio_test";
    process.env.DATABASE_URL = unreachable;
    process.env.DATABASE_DIRECT_URL = unreachable;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const downApp: INestApplication<App> =
      moduleFixture.createNestApplication();
    await downApp.init();

    try {
      await request(downApp.getHttpServer()).get("/health/db").expect(503);
    } finally {
      await downApp.close();
      process.env.DATABASE_URL = previousUrl;
      process.env.DATABASE_DIRECT_URL = previousDirectUrl;
    }
  });
});
