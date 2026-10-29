import { BadRequestException } from "@nestjs/common";
import { ResumeModelEnvironment, ResumeModelProvider } from "@prisma/client";

export type ResumeModelSettingInput = {
  environment: ResumeModelEnvironment;
  provider: ResumeModelProvider;
  modelName: string;
  url: string;
  secretRef: string;
};

const oneOf = <T extends string>(
  value: unknown,
  allowed: Record<string, T>,
  field: string,
): T => {
  const values = Object.values(allowed);
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new BadRequestException(
      `${field}는 ${values.join(", ")} 중 하나여야 합니다.`,
    );
  }
  return value as T;
};

// MCP가 이 주소로 토큰을 보내므로 공급자 공식 호스트 밖으로는 보내지 않는다
const allowedHosts: Record<ResumeModelProvider, string> = {
  openrouter: "openrouter.ai",
};

const parseUrl = (value: unknown, provider: ResumeModelProvider): string => {
  if (typeof value !== "string" || !URL.canParse(value)) {
    throw new BadRequestException("url은 올바른 주소여야 합니다.");
  }
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== allowedHosts[provider] ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new BadRequestException(
      `url은 https://${allowedHosts[provider]} 주소여야 합니다.`,
    );
  }
  return url.toString();
};

const parseModelName = (value: unknown): string => {
  const modelName = typeof value === "string" ? value.trim() : "";
  if (modelName === "" || modelName.length > 200) {
    throw new BadRequestException("modelName은 1~200자여야 합니다.");
  }
  return modelName;
};

// MCP 런타임 계정이 읽을 수 있는 시크릿을 이 접두사로 한정한다. Secret Manager 이름은 255자 이하다
const secretRefPattern = /^RESUME_MODEL_TOKEN[A-Za-z0-9_-]{0,237}$/;

const parseSecretRef = (value: unknown): string => {
  if (typeof value !== "string" || !secretRefPattern.test(value)) {
    throw new BadRequestException(
      "secretRef는 RESUME_MODEL_TOKEN으로 시작하는 Secret Manager 시크릿 이름이어야 합니다.",
    );
  }
  return value;
};

export const parseResumeModelSettingInput = (
  body: unknown,
): ResumeModelSettingInput => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("요청 본문은 객체여야 합니다.");
  }
  const input = body as Record<string, unknown>;
  const provider = oneOf(input.provider, ResumeModelProvider, "provider");
  // 요청 본문을 펼치지 않는다. isActive 같은 필드가 섞이면 활성화 트랜잭션을 우회한다
  return {
    environment: oneOf(
      input.environment,
      ResumeModelEnvironment,
      "environment",
    ),
    provider,
    modelName: parseModelName(input.modelName),
    url: parseUrl(input.url, provider),
    secretRef: parseSecretRef(input.secretRef),
  };
};
