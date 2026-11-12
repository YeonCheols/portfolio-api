import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createPublicKey, type JsonWebKey } from "crypto";
import { decode, verify as verifyJwt } from "jsonwebtoken";

// Public trust policy: all repositories owned by YeonCheols (immutable GitHub user ID).
export const GITHUB_ACTIONS_OWNER_ID = "91575756";
export const GITHUB_ACTIONS_ISSUER =
  "https://token.actions.githubusercontent.com";
type SigningKey = JsonWebKey & { kid?: string; alg?: string; use?: string };

@Injectable()
export class GitHubActionsOidcService {
  private keys: SigningKey[] = [];
  private expiresAt = 0;

  async verify(token: string, audience: string): Promise<void> {
    const decoded = decode(token, { complete: true });
    if (!decoded || decoded.header.alg !== "RS256" || !decoded.header.kid)
      throw new UnauthorizedException();
    if (
      Date.now() >= this.expiresAt ||
      !this.keys.some((key) => key.kid === decoded.header.kid)
    ) {
      try {
        const response = await fetch(
          `${GITHUB_ACTIONS_ISSUER}/.well-known/jwks`,
          { redirect: "error", signal: AbortSignal.timeout(5000) },
        );
        if (!response.ok) throw new Error();
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("keys" in body) ||
          !Array.isArray(body.keys) ||
          body.keys.length > 100
        )
          throw new Error();
        this.keys = body.keys.filter(
          (key): key is SigningKey =>
            !!key &&
            typeof key === "object" &&
            key.kty === "RSA" &&
            typeof key.kid === "string" &&
            typeof key.n === "string" &&
            typeof key.e === "string" &&
            (key.alg === undefined || key.alg === "RS256") &&
            (key.use === undefined || key.use === "sig"),
        );
        this.expiresAt = Date.now() + 300000;
      } catch {
        throw new ServiceUnavailableException(
          "GitHub 인증 키를 확인할 수 없습니다.",
        );
      }
    }
    const key = this.keys.find((key) => key.kid === decoded.header.kid);
    if (!key) throw new UnauthorizedException();
    try {
      const claims = verifyJwt(token, createPublicKey({ key, format: "jwk" }), {
        algorithms: ["RS256"],
        issuer: GITHUB_ACTIONS_ISSUER,
        audience,
      });
      if (
        typeof claims === "string" ||
        claims.repository_owner_id !== GITHUB_ACTIONS_OWNER_ID ||
        typeof claims.sub !== "string" ||
        !claims.sub ||
        typeof claims.exp !== "number" ||
        typeof claims.iat !== "number" ||
        claims.iat > Date.now() / 1000 + 60 ||
        claims.exp <= claims.iat
      )
        throw new Error();
    } catch {
      throw new UnauthorizedException();
    }
  }
}
