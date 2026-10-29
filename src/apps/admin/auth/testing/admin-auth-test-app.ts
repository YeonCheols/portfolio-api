import { INestApplication, Provider, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as jwt from "jsonwebtoken";
import { App } from "supertest/types";
import { PrismaService } from "src/prisma/prisma.service";
import { JwtStrategy } from "../jwt.strategy";

export const TEST_JWT_SECRET = "test-jwt-secret";
export const TEST_ADMIN = { id: 1, email: "admin@test.com" };

// undefined를 그대로 대입하면 문자열 "undefined"가 들어가 키가 있는 것처럼 남는다
export const restoreJwtSecret = (original: string | undefined) => {
  if (original === undefined) {
    delete process.env.JWT_SECRET;
    return;
  }
  process.env.JWT_SECRET = original;
};

export const signTestAdminToken = (secret: string = TEST_JWT_SECRET) =>
  jwt.sign({ sub: TEST_ADMIN.id, email: TEST_ADMIN.email }, secret, {
    expiresIn: "1h",
  });

// 가드와 JwtStrategy는 실제 구현을 쓰고, DB와 도메인 서비스만 대체해 HTTP 인증 경계를 검증한다
export const createAdminAuthTestApp = async (
  controller: Type<unknown>,
  providers: Provider[],
): Promise<INestApplication<App>> => {
  const prisma = {
    adminUser: { findUnique: jest.fn().mockResolvedValue(TEST_ADMIN) },
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [
      JwtStrategy,
      { provide: PrismaService, useValue: prisma },
      ...providers,
    ],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();
  return app;
};
