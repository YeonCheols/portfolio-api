import { PrismaService } from "src/prisma/prisma.service";
import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy", () => {
  const prisma = {
    adminUser: {
      findUnique: jest.fn(),
    },
  };
  const strategy = new JwtStrategy(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
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
