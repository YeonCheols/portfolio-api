import { createHash } from "crypto";
import { UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { OAuthStateService } from "./oauth-state.service";

describe("OAuthStateService", () => {
  const prisma = {
    authHistory: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  let service: OAuthStateService;
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const pending = (overrides: Record<string, unknown> = {}) => ({
    id: "history-1",
    clientId: "admin",
    userId: null,
    redirectUri: "https://api.example.com/cb",
    status: "pending",
    stateConsumedAt: null,
    stateExpiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OAuthStateService(prisma as unknown as PrismaService);
  });

  it("state 원문이 아닌 해시를 만료 시간과 함께 저장하고 만료된 대기 기록을 지운다", async () => {
    const state = await service.issue("admin", "https://api.example.com/cb");

    expect(state).toEqual(expect.any(String));
    expect(state.length).toBeGreaterThanOrEqual(32);
    expect(prisma.authHistory.deleteMany).toHaveBeenCalledWith({
      where: { status: "pending", expiresAt: { lt: expect.any(Date) } },
    });
    const data = prisma.authHistory.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      clientId: "admin",
      redirectUri: "https://api.example.com/cb",
      stateHash: hash(state),
      status: "pending",
      userId: null,
    });
    expect(JSON.stringify(data)).not.toContain(state);
    expect(data.stateExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("유효한 state는 한 번만 소비하고 기록을 돌려준다", async () => {
    prisma.authHistory.findUnique.mockResolvedValue(pending());
    prisma.authHistory.updateMany.mockResolvedValue({ count: 1 });

    const record = await service.consume("state", "admin");

    expect(record.id).toBe("history-1");
    expect(prisma.authHistory.findUnique).toHaveBeenCalledWith({
      where: { stateHash: hash("state") },
    });
    expect(prisma.authHistory.updateMany).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["없는 state", null],
    ["다른 client의 state", pending({ clientId: "mcp" })],
    ["이미 소비된 state", pending({ stateConsumedAt: new Date() })],
    ["만료된 state", pending({ stateExpiresAt: new Date(Date.now() - 1) })],
    ["대기 상태가 아닌 기록", pending({ status: "authenticated" })],
    ["사용자가 이미 연결된 기록", pending({ userId: 1 })],
  ])("%s는 거절하고 소비하지 않는다", async (_name, record) => {
    prisma.authHistory.findUnique.mockResolvedValue(record);

    await expect(service.consume("state", "admin")).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.authHistory.updateMany).not.toHaveBeenCalled();
  });

  it("동시에 소비되어 갱신된 행이 없으면 거절한다", async () => {
    prisma.authHistory.findUnique.mockResolvedValue(pending());
    prisma.authHistory.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.consume("state", "admin")).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
