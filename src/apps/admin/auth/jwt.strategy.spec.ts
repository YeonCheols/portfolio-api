import { PrismaService } from "src/prisma/prisma.service";
import { JwtStrategy } from "./jwt.strategy";
import { restoreJwtSecret } from "./testing/admin-auth-test-app";

describe("JwtStrategy", () => {
  const originalSecret = process.env.JWT_SECRET;
  const prisma = {
    adminUser: {
      findUnique: jest.fn(),
    },
  };
  let strategy: JwtStrategy;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
    strategy = new JwtStrategy(prisma as unknown as PrismaService);
  });

  afterAll(() => {
    restoreJwtSecret(originalSecret);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it.each([
      ["없으면", undefined],
      ["비어 있으면", ""],
      ["공백뿐이면", "   "],
    ])("JWT_SECRET이 %s 생성에 실패한다", (_label, secret) => {
      restoreJwtSecret(secret);

      try {
        expect(
          () => new JwtStrategy(prisma as unknown as PrismaService),
        ).toThrow("JWT_SECRET");
      } finally {
        process.env.JWT_SECRET = "test-secret";
      }
    });
  });

  describe("validate", () => {
    it("토큰의 sub로 관리자를 조회해 반환한다", async () => {
      const user = { id: 1, email: "admin@test.com" };
      prisma.adminUser.findUnique.mockResolvedValue(user);

      await expect(
        strategy.validate({ sub: 1, email: "admin@test.com" }),
      ).resolves.toEqual(user);
      expect(prisma.adminUser.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it("관리자가 없으면 null을 반환한다", async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(strategy.validate({ sub: 99 })).resolves.toBeNull();
    });
  });
});
