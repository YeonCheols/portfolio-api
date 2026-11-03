import { BadRequestException } from "@nestjs/common";
import { ResumeModelEnvironment, ResumeModelProvider } from "@prisma/client";

export type ResumeModelSettingInput = {
  environment: ResumeModelEnvironment;
  provider: ResumeModelProvider;
  modelName: string;
  url: string;
  apiKey?: string;
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

const parseApiKey = (value: unknown): string => {
  const apiKey = typeof value === "string" ? value.trim() : "";
  if (!apiKey || apiKey.length > 4096 || /[\0\r\n]/.test(apiKey)) {
    throw new BadRequestException("apiKey는 유효한 모델 API 키여야 합니다.");
  }
  return apiKey;
};

export const parseResumeModelSettingInput = (
  body: unknown,
  options: { requireApiKey: boolean } = { requireApiKey: true },
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
    ...(input.apiKey !== undefined || options.requireApiKey
      ? { apiKey: parseApiKey(input.apiKey) }
      : {}),
  };
};
