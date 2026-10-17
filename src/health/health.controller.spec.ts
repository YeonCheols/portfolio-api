import { INestApplication, ServiceUnavailableException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { App } from "supertest/types";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  let app: INestApplication<App>;
  const healthService = { check: jest.fn(), checkDb: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /health", () => {
    it("200과 앱 상태를 캐시하지 않도록 반환한다", async () => {
      healthService.check.mockReturnValue({ status: "ok" });

      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
      expect(res.headers["cache-control"]).toBe("no-store");
    });
  });

  describe("GET /health/db", () => {
    it("DB가 정상이면 200과 DB 상태를 캐시하지 않도록 반환한다", async () => {
      healthService.checkDb.mockResolvedValue({
        status: "ok",
        db: "up",
        latencyMs: 12,
      });

      const res = await request(app.getHttpServer()).get("/health/db");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok", db: "up", latencyMs: 12 });
      expect(res.headers["cache-control"]).toBe("no-store");
    });

    it("DB가 비정상이면 503과 db down을 반환한다", async () => {
      healthService.checkDb.mockRejectedValue(
        new ServiceUnavailableException({ status: "error", db: "down" }),
      );

      const res = await request(app.getHttpServer()).get("/health/db");

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: "error", db: "down" });
      expect(res.headers["cache-control"]).toBe("no-store");
    });
  });
});
