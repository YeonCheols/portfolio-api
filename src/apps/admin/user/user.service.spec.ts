import { Test } from "@nestjs/testing";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "src/prisma/prisma.service";
import { restoreJwtSecret } from "../auth/testing/admin-auth-test-app";
import { AdminUserService } from "./user.service";

jest.mock("bcryptjs");

describe("AdminUserService", () => {
  let service: AdminUserService;
  const hash = jest.mocked(bcrypt.hash);
  const compare = jest.mocked(bcrypt.compare);
  const prisma = {
    adminUser: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const user = { id: 1, email: "admin@test.com", password: "hashed" };
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterAll(() => {
    restoreJwtSecret(originalSecret);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    hash.mockResolvedValue("hashed" as never);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminUserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AdminUserService);
  });

  describe("create", () => {
    it("비밀번호를 해시해서 저장한다", async () => {
      await service.create({ email: user.email, password: "plain" });

      expect(hash).toHaveBeenCalledWith("plain", 10);
      expect(prisma.adminUser.create).toHaveBeenCalledWith({
        data: { email: user.email, password: "hashed" },
      });
    });
  });

  describe("resetPassword", () => {
    it("사용자가 없으면 NotFoundException을 던진다", async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({ email: "none@test.com", newPassword: "new" }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.adminUser.update).not.toHaveBeenCalled();
    });

    it("새 비밀번호를 해시해서 저장한다", async () => {
      prisma.adminUser.findUnique.mockResolvedValue(user);

      await service.resetPassword({ email: user.email, newPassword: "new" });

      expect(hash).toHaveBeenCalledWith("new", 10);
      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { email: user.email },
        data: { password: "hashed" },
      });
    });
  });

  describe("login", () => {
    it("사용자가 없으면 UnauthorizedException을 던진다", async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "none@test.com", password: "pw" }),
      ).rejects.toThrow(UnauthorizedException);
      expect(compare).not.toHaveBeenCalled();
    });

    it("비밀번호가 틀리면 UnauthorizedException을 던지고 접속 시간을 갱신하지 않는다", async () => {
      prisma.adminUser.findUnique.mockResolvedValue(user);
      compare.mockResolvedValue(false as never);

      await expect(
        service.login({ email: user.email, password: "wrong" }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.adminUser.update).not.toHaveBeenCalled();
    });

    it("로그인에 성공하면 접속 시간을 갱신하고 JWT를 발급한다", async () => {
      prisma.adminUser.findUnique.mockResolvedValue(user);
      compare.mockResolvedValue(true as never);

      const result = await service.login({
        email: user.email,
        password: "plain",
      });

      expect(compare).toHaveBeenCalledWith("plain", "hashed");
      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { updatedAt: expect.any(Date) },
      });
      expect(result.user).toEqual({ id: 1, email: user.email });
      const payload = jwt.verify(result.accessToken, "test-secret");
      expect(payload).toEqual(
        expect.objectContaining({ sub: 1, email: user.email }),
      );
    });

    it.each([
      ["없으면", undefined],
      ["비어 있으면", ""],
      ["공백뿐이면", "   "],
    ])(
      "JWT_SECRET이 %s 토큰을 발급하지 않고 실패한다",
      async (_label, secret) => {
        restoreJwtSecret(secret);
        prisma.adminUser.findUnique.mockResolvedValue(user);
        compare.mockResolvedValue(true as never);

        try {
          await expect(
            service.login({ email: user.email, password: "plain" }),
          ).rejects.toThrow("JWT_SECRET");
        } finally {
          process.env.JWT_SECRET = "test-secret";
        }
      },
    );

    it("JWT_SECRET이 없으면 접속 시간을 갱신하지 않는다", async () => {
      restoreJwtSecret(undefined);
      prisma.adminUser.findUnique.mockResolvedValue(user);
      compare.mockResolvedValue(true as never);

      try {
        await expect(
          service.login({ email: user.email, password: "plain" }),
        ).rejects.toThrow("JWT_SECRET");
        expect(prisma.adminUser.update).not.toHaveBeenCalled();
      } finally {
        process.env.JWT_SECRET = "test-secret";
      }
    });
  });
});
