import { generateKeyPairSync } from "crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import * as request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

// jest-e2e.setup.ts가 로컬 portfolio_test DB만 허용합니다.
describe("프로젝트 서비스 OAuth·저장 테스트 DB 통합", () => {
  const previousEnv = { ...process.env };
  const clientId = "integration-project-service";
  const clientSecret = "integration-only-secret";
  const slug = "integration-service-project";
  const body = {
    slug,
    title: "Hub 프로젝트",
    description: "서비스 연동 검증",
    image: "",
    stacks: '["ServiceTestReact","ServiceTestNestJS"]',
    content: "자유 형식 PROJECT.MD 본문입니다.",
    linkGithub: "https://example.com/project",
  };
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let token: string;

  const basic = () =>
    `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;

  const issueToken = () =>
    request(app.getHttpServer())
      .post("/auth/token")
      .set("Authorization", basic())
      .type("form")
      .send({ grant_type: "client_credentials", scope: "project:write" });

  const save = (
    data: Omit<typeof body, "linkGithub"> & {
      linkGithub?: string | null;
    } = body,
    accessToken: string = token,
  ) =>
    request(app.getHttpServer())
      .put("/service/project")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(data);

  beforeAll(async () => {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.AUTH_PRIVATE_KEY = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.MCP_AUTH_SERVICE_TOKEN = "integration-mcp-service-token";
    process.env.PORTFOLIO_AUTH_SERVICE_TOKEN =
      "integration-obsolete-portfolio-token";
    process.env.AUTH_ISSUER = "https://integration.invalid/auth";
    process.env.SERVICE_OAUTH_CLIENT_ID = clientId;
    process.env.SERVICE_OAUTH_CLIENT_SECRET = clientSecret;
    process.env.SERVICE_OAUTH_AUDIENCE =
      "https://integration.invalid/service/project";
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    await prisma.projectTag.deleteMany({ where: { project: { slug } } });
    await prisma.project.deleteMany({ where: { slug } });
    await prisma.authHistory.deleteMany({ where: { oauthClientId: clientId } });
    const response = await issueToken().expect(200);
    token = response.body.access_token as string;
  });

  afterAll(async () => {
    await app?.close();
    if (prisma) {
      await prisma.projectTag.deleteMany({ where: { project: { slug } } });
      await prisma.project.deleteMany({ where: { slug } });
      await prisma.tag.deleteMany({
        where: { name: { startsWith: "ServiceTest" } },
      });
      await prisma.authHistory.deleteMany({
        where: { oauthClientId: clientId },
      });
      await prisma.$disconnect();
    }
    process.env = previousEnv;
  });

  it("서비스 토큰으로 생성·조회·무변경·수정하면 DB와 태그를 함께 반영하고 정렬을 유지한다", async () => {
    const created = await save().expect(200);
    expect(created.body.operation).toBe("created");
    expect(created.body.project).toMatchObject({
      ...body,
      isShow: true,
      isRecent: true,
    });
    const first = await prisma.project.findUniqueOrThrow({ where: { slug } });
    await prisma.project.update({ where: { slug }, data: { order: 71 } });

    const unchanged = await save().expect(200);
    expect(unchanged.body.operation).toBe("unchanged");
    expect(unchanged.body.project.updatedAt).toBe(
      first.updatedAt.toISOString(),
    );
    expect(unchanged.body.project.order).toBe(71);
    expect(unchanged.body.project).not.toHaveProperty("projectTags");

    const next = {
      ...body,
      title: "수정된 Hub 프로젝트",
      content: "수정된 자유 형식 본문",
      stacks: '["ServiceTestNestJS"]',
      linkGithub: null,
    };
    // 실제 내용 변경 시 과거 시각에서 현재로 갱신되는지 확인합니다.
    await prisma.project.update({
      where: { slug },
      data: { updatedAt: new Date("2020-01-01") },
    });
    const updated = await save(next).expect(200);
    expect(updated.body.operation).toBe("updated");
    expect(updated.body.project).toMatchObject({
      title: next.title,
      order: 71,
      isRecent: true,
    });
    const stored = await prisma.project.findUniqueOrThrow({
      where: { slug },
      include: { projectTags: { include: { tag: true } } },
    });
    expect(stored.linkGithub).toBeNull();
    expect(stored.projectTags.map((relation) => relation.tag.name)).toEqual([
      "ServiceTestNestJS",
    ]);
    expect(stored.updatedAt.getTime()).toBeGreaterThan(
      new Date("2020-01-01").getTime(),
    );
    await request(app.getHttpServer())
      .get(`/project/${slug}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          slug,
          title: next.title,
          content: next.content,
          isRecent: true,
        });
      });
    await request(app.getHttpServer())
      .get("/project")
      .expect(200)
      .expect((response) => {
        expect(
          (response.body as { slug: string }[]).some(
            (project) => project.slug === slug,
          ),
        ).toBe(true);
      });
    await save(next)
      .expect(200)
      .expect((response) => {
        expect(response.body.operation).toBe("unchanged");
        expect(response.body.project.updatedAt).toBe(
          stored.updatedAt.toISOString(),
        );
      });
  });

  it("무인증·잘못된 자격·scope·입력은 프로젝트 저장 전에 거부한다", async () => {
    await request(app.getHttpServer())
      .put("/service/project")
      .send(body)
      .expect(401);
    await save({ ...body, stacks: "not-json" }).expect(400);
    await request(app.getHttpServer())
      .put("/service/project")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...body, isShow: false })
      .expect(400);
    await request(app.getHttpServer())
      .post("/auth/token")
      .type("form")
      .send({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: "wrong",
      })
      .expect(401);
    await request(app.getHttpServer())
      .post("/auth/token")
      .set("Authorization", basic())
      .type("form")
      .send({ grant_type: "client_credentials", scope: "resume:use" })
      .expect(400);
    await expect(prisma.project.count({ where: { slug } })).resolves.toBe(0);
  });

  it("인증 이력이 만료되거나 폐기된 서비스 토큰은 저장을 거부한다", async () => {
    await prisma.authHistory.updateMany({
      where: { oauthClientId: clientId },
      data: { revokedAt: new Date() },
    });
    await save().expect(401);
    const response = await issueToken().expect(200);
    const nextToken = response.body.access_token as string;
    await prisma.authHistory.updateMany({
      where: { oauthClientId: clientId },
      data: { expiresAt: new Date("2020-01-01") },
    });
    await save(body, nextToken).expect(401);
    await expect(prisma.project.count({ where: { slug } })).resolves.toBe(0);
  });

  it("같은 slug를 동시에 생성해도 프로젝트와 태그 관계를 중복 저장하지 않는다", async () => {
    const results = await Promise.all([save(), save()]);
    expect(results.map((response) => response.status)).toEqual([200, 200]);
    expect(
      results.map((response) => response.body.operation as string).sort(),
    ).toEqual(["created", "unchanged"]);
    await expect(prisma.project.count({ where: { slug } })).resolves.toBe(1);
    await expect(
      prisma.projectTag.count({ where: { project: { slug } } }),
    ).resolves.toBe(2);
  });
  it("비MCP 서버 인증은 auth:manage OAuth로만 통과하고 MCP 고정 인증과 프로젝트 권한은 유지한다", async () => {
    const issued = await request(app.getHttpServer())
      .post("/auth/token")
      .set("Authorization", basic())
      .type("form")
      .send({ grant_type: "client_credentials", scope: "auth:manage" })
      .expect(200);
    const accessToken = issued.body.access_token as string;
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ client_id: "portfolio" })
      .expect(400);
    for (const rejected of [token, "integration-obsolete-portfolio-token"]) {
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Authorization", `Bearer ${rejected}`)
        .send({ client_id: "portfolio" })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ client_id: "portfolio" })
      .expect(401);
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Authorization", "Bearer integration-mcp-service-token")
      .send({ client_id: "mcp" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ client_id: "mcp" })
      .expect(401);
    await save(body, accessToken).expect(401);
  });
});
