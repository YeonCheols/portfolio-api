import { randomBytes, createHash } from "crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthHistory, AuthHistoryStatus } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const hashState = (state: string): string =>
  createHash("sha256").update(state).digest("hex");

/** 공급자 OAuth 시작·완료를 잇는 일회용 state를 발급하고 소비합니다. */
@Injectable()
export class OAuthStateService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(clientId: string, redirectUri: string): Promise<string> {
    const now = new Date();
    await this.prisma.authHistory.deleteMany({
      where: {
        status: AuthHistoryStatus.pending,
        expiresAt: { lt: now },
      },
    });
    const state = randomBytes(32).toString("base64url");
    const stateExpiresAt = new Date(now.getTime() + OAUTH_STATE_TTL_MS);
    await this.prisma.authHistory.create({
      data: {
        clientId,
        userId: null,
        redirectUri,
        stateHash: hashState(state),
        stateExpiresAt,
        stateConsumedAt: null,
        audience: null,
        scope: null,
        status: AuthHistoryStatus.pending,
        expiresAt: stateExpiresAt,
      },
    });
    return state;
  }

  async consume(state: string, clientId: string): Promise<AuthHistory> {
    const record = await this.prisma.authHistory.findUnique({
      where: { stateHash: hashState(state) },
    });
    if (
      !record ||
      record.clientId !== clientId ||
      record.status !== AuthHistoryStatus.pending ||
      record.userId !== null ||
      record.stateConsumedAt ||
      !record.stateExpiresAt ||
      record.stateExpiresAt <= new Date() ||
      !record.redirectUri
    ) {
      throw new UnauthorizedException();
    }
    const consumed = await this.prisma.authHistory.updateMany({
      where: {
        id: record.id,
        clientId,
        status: AuthHistoryStatus.pending,
        userId: null,
        stateConsumedAt: null,
        stateExpiresAt: { gt: new Date() },
      },
      data: { stateConsumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException();
    return record;
  }
}
