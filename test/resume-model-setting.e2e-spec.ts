import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import * as jwt from "jsonwebtoken";
import * as request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

describe("이력서 모델 설정 테스트 DB 통합", () => {
  const originalReadToken = process.env.RESUME_MODEL_SETTING_TOKEN;
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let adminToken: string;
  const setting = {
    provider: "openrouter",
    modelName: "anthropic/claude-sonnet-5.5",
    url: "https://openrouter.ai/api/v1/chat/completions",
    secretRef: "RESUME_MODEL_TOKEN_OPENROUTER",
  } as const;

  beforeAll(async () => {
    process.env.RESUME_MODEL_SETTING_TOKEN = "integration-read-token";
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
    await prisma.adminUser.deleteMany({
      where: { email: "model-setting@test.invalid" },
    });
    const admin = await prisma.adminUser.create({
      data: { email: "model-setting@test.invalid", password: "unused" },
    });
    adminToken = jwt.sign(
      { sub: admin.id, email: admin.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "5m" },
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    await prisma.resumeModelSetting.deleteMany();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.resumeModelSetting.deleteMany();
    await prisma?.adminUser.deleteMany({
      where: { email: "model-setting@test.invalid" },
    });
    await prisma?.$disconnect();
    if (originalReadToken === undefined) {
      delete process.env.RESUME_MODEL_SETTING_TOKEN;
    } else {
      process.env.RESUME_MODEL_SETTING_TOKEN = originalReadToken;
    }
  });

  it("같은 환경에 활성 설정을 두 개 쓰면 DB가 거부한다", async () => {
    await prisma.resumeModelSetting.create({
      data: { ...setting, environment: "production", isActive: true },
    });

    await expect(
      prisma.resumeModelSetting.create({
        data: { ...setting, environment: "production", isActive: true },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("다른 환경의 활성 설정과 여러 비활성 설정은 함께 저장된다", async () => {
    await prisma.resumeModelSetting.createMany({
      data: [
        { ...setting, environment: "production", isActive: true },
        { ...setting, environment: "development", isActive: true },
        { ...setting, environment: "production", isActive: false },
        { ...setting, environment: "production", isActive: false },
      ],
    });

    await expect(prisma.resumeModelSetting.count()).resolves.toBe(4);
  });

  it("관리 API로 만든 설정을 활성화하고 전환하면 조회 API가 활성 설정만 반환한다", async () => {
    const server = app.getHttpServer();
    const admin = { Authorization: `Bearer ${adminToken}` };
    const read = { Authorization: "Bearer integration-read-token" };

    const first = await request(server)
      .post("/admin/resume-model-setting")
      .set(admin)
      .send({ ...setting, environment: "production" })
      .expect(201);
    const second = await request(server)
      .post("/admin/resume-model-setting")
      .set(admin)
      .send({
        ...setting,
        environment: "production",
        modelName: "openai/gpt-5",
      })
      .expect(201);

    await request(server)
      .get("/resume-model-setting/active?environment=production")
      .set(read)
      .expect(404);

    await request(server)
      .post(`/admin/resume-model-setting/${first.body.id}/activate`)
      .set(admin)
      .expect(200);
    await request(server)
      .get("/resume-model-setting/active?environment=production")
      .set(read)
      .expect(200)
      .expect(setting);

    await request(server)
      .post(`/admin/resume-model-setting/${second.body.id}/activate`)
      .set(admin)
      .expect(200);
    await request(server)
      .get("/resume-model-setting/active?environment=production")
      .set(read)
      .expect(200)
      .expect({ ...setting, modelName: "openai/gpt-5" });

    await expect(
      prisma.resumeModelSetting.count({
        where: { environment: "production", isActive: true },
      }),
    ).resolves.toBe(1);
    await request(server)
      .get("/resume-model-setting/active?environment=development")
      .set(read)
      .expect(404);
  });
});
