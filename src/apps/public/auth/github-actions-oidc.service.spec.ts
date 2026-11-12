import { generateKeyPairSync } from "crypto";
import { sign } from "jsonwebtoken";
import {
  GitHubActionsOidcService,
  GITHUB_ACTIONS_ISSUER,
  GITHUB_ACTIONS_OWNER_ID,
} from "./github-actions-oidc.service";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const audience = "https://api.example.com";
const makeToken = (claims: Record<string, unknown> = {}) =>
  sign(
    { repository_owner_id: GITHUB_ACTIONS_OWNER_ID, ...claims },
    keys.privateKey,
    {
      algorithm: "RS256",
      keyid: "github-key",
      issuer: GITHUB_ACTIONS_ISSUER,
      audience,
      subject: "repo:owner/project:ref:refs/heads/master",
      expiresIn: 300,
    },
  );

afterEach(() => jest.restoreAllMocks());
it("GitHub가 서명한 토큰의 소유자 ID를 확인하고 이름이나 저장소별 비밀값을 요구하지 않는다", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        keys: [
          {
            ...keys.publicKey.export({ format: "jwk" }),
            kid: "github-key",
            alg: "RS256",
            use: "sig",
          },
        ],
      }),
    ),
  );
  const service = new GitHubActionsOidcService();
  await expect(service.verify(makeToken(), audience)).resolves.toBeUndefined();
  await expect(
    service.verify(
      makeToken({ repository: "owner/another-project" }),
      audience,
    ),
  ).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    `${GITHUB_ACTIONS_ISSUER}/.well-known/jwks`,
    expect.objectContaining({ redirect: "error" }),
  );
});

it("다른 소유자·위조 서명·다른 대상·잘못된 발급처·만료·누락 claim은 거부한다", async () => {
  const fetchMock = jest.spyOn(global, "fetch");
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        keys: [
          { ...keys.publicKey.export({ format: "jwk" }), kid: "github-key" },
        ],
      }),
    ),
  );
  const service = new GitHubActionsOidcService();
  const claims = { repository_owner_id: GITHUB_ACTIONS_OWNER_ID };
  const options = {
    algorithm: "RS256" as const,
    keyid: "github-key",
    issuer: GITHUB_ACTIONS_ISSUER,
    audience,
    subject: "repo:owner/project:ref:refs/heads/master",
    expiresIn: 300,
  };
  const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const withoutExpiry = {
    algorithm: options.algorithm,
    keyid: options.keyid,
    issuer: options.issuer,
    audience,
    subject: options.subject,
  };
  for (const token of [
    makeToken({
      repository_owner_id: "someone-else",
      repository_owner: "YeonCheols",
    }),
    sign(claims, attacker.privateKey, options),
    sign(claims, keys.privateKey, {
      ...options,
      audience: "https://wrong.invalid",
    }),
    sign(claims, keys.privateKey, {
      ...options,
      issuer: "https://wrong.invalid",
    }),
    sign(claims, keys.privateKey, { ...options, expiresIn: -1 }),
    sign(claims, keys.privateKey, withoutExpiry),
    makeToken({ iat: Math.floor(Date.now() / 1000) + 120 }),
    "broken-token",
  ])
    await expect(service.verify(token, audience)).rejects.toMatchObject({
      status: 401,
    });
});
it("GitHub 키 조회 장애는 비밀 오류 원문 없이 실패하고 신뢰하지 않는 키를 사용하지 않는다", async () => {
  jest
    .spyOn(global, "fetch")
    .mockRejectedValue(new Error("private-upstream-error"));
  await expect(
    new GitHubActionsOidcService().verify(makeToken(), audience),
  ).rejects.toMatchObject({
    status: 503,
    message: "GitHub 인증 키를 확인할 수 없습니다.",
  });
});
it("GitHub 서명키가 회전하면 새 kid에 대해 고정된 JWKS에서 다시 조회한다", async () => {
  const next = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          keys: [
            { ...keys.publicKey.export({ format: "jwk" }), kid: "github-key" },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          keys: [
            { ...next.publicKey.export({ format: "jwk" }), kid: "next-key" },
          ],
        }),
      ),
    );
  const service = new GitHubActionsOidcService();
  await service.verify(makeToken(), audience);
  const token = sign(
    { repository_owner_id: GITHUB_ACTIONS_OWNER_ID },
    next.privateKey,
    {
      algorithm: "RS256",
      keyid: "next-key",
      issuer: GITHUB_ACTIONS_ISSUER,
      audience,
      subject: "repo:owner/other",
      expiresIn: 300,
    },
  );
  await expect(service.verify(token, audience)).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
