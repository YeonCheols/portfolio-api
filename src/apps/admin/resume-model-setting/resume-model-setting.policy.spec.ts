import { BadRequestException } from "@nestjs/common";
import { parseResumeModelSettingInput } from "./resume-model-setting.policy";

describe("parseResumeModelSettingInput", () => {
  const valid = {
    environment: "production",
    provider: "openrouter",
    modelName: "anthropic/claude-sonnet-5.5",
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: "fake-provider-api-key",
  };

  it("실제 API 키를 입력하면 참조명 없이 저장할 설정을 반환한다", () => {
    const input = {
      environment: "production",
      provider: "openrouter",
      modelName: "vendor/model",
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: "fake-provider-api-key",
    };
    expect(parseResumeModelSettingInput(input)).toEqual(input);
  });

  it("OpenAI의 공식 HTTPS 주소로 입력하면 openai 설정을 반환한다", () => {
    const input = {
      ...valid,
      provider: "openai",
      modelName: "test-openai-model",
      url: "https://api.openai.com/v1/responses",
    };

    expect(parseResumeModelSettingInput(input)).toEqual(input);
  });

  it("Gemini의 공식 HTTPS 주소로 입력하면 gemini 설정을 반환한다", () => {
    const input = {
      ...valid,
      provider: "gemini",
      modelName: "test-gemini-model",
      url: "https://generativelanguage.googleapis.com/v1beta/models/test-gemini-model:generateContent",
    };

    expect(parseResumeModelSettingInput(input)).toEqual(input);
  });

  it("유효한 입력이면 허용한 다섯 필드만 반환하고 다른 필드는 버린다", () => {
    expect(
      parseResumeModelSettingInput({
        ...valid,
        id: 99,
        isActive: true,
        token: "raw-token",
      }),
    ).toEqual(valid);
  });

  it.each([null, undefined, "text", ["production"]])(
    "입력이 객체가 아닌 %p이면 BadRequestException을 던진다",
    (input) => {
      expect(() => parseResumeModelSettingInput(input)).toThrow(
        BadRequestException,
      );
    },
  );

  it.each(["staging", "", undefined, 1])(
    "환경이 %p이면 BadRequestException을 던진다",
    (environment) => {
      expect(() =>
        parseResumeModelSettingInput({ ...valid, environment }),
      ).toThrow(BadRequestException);
    },
  );

  it.each(["unsupported-provider", "", undefined])(
    "공급자가 %p이면 BadRequestException을 던진다",
    (provider) => {
      expect(() =>
        parseResumeModelSettingInput({ ...valid, provider }),
      ).toThrow(BadRequestException);
    },
  );

  it.each(["", "   ", undefined, 3, "a".repeat(201)])(
    "모델 이름이 %p이면 BadRequestException을 던진다",
    (modelName) => {
      expect(() =>
        parseResumeModelSettingInput({ ...valid, modelName }),
      ).toThrow(BadRequestException);
    },
  );

  it.each([
    "http://openrouter.ai/api/v1/chat/completions",
    "https://example.com/api/v1/chat/completions",
    "https://169.254.169.254/computeMetadata/v1/",
    "https://openrouter.ai.evil.example/api",
    "https://openrouter.ai@evil.example/api",
    "not a url",
    undefined,
  ])("호출 주소가 %p이면 BadRequestException을 던진다", (url) => {
    expect(() => parseResumeModelSettingInput({ ...valid, url })).toThrow(
      BadRequestException,
    );
  });

  describe.each([
    { provider: "openai", host: "api.openai.com" },
    { provider: "gemini", host: "generativelanguage.googleapis.com" },
  ])("$provider의 호스트 검증", ({ provider, host }) => {
    it.each([
      `http://${host}/api`,
      "https://example.com/api",
      "https://openrouter.ai/api/v1/chat/completions",
      `https://${host}.evil.example/api`,
      `https://${host}@evil.example/api`,
      `https://user:password@${host}/api`,
    ])("호출 주소가 %s이면 BadRequestException을 던진다", (url) => {
      expect(() =>
        parseResumeModelSettingInput({ ...valid, provider, url }),
      ).toThrow(BadRequestException);
    });
  });

  it.each([
    { provider: "openai", url: "https://generativelanguage.googleapis.com/" },
    { provider: "gemini", url: "https://api.openai.com/" },
    { provider: "openrouter", url: "https://api.openai.com/" },
    {
      provider: "openrouter",
      url: "https://generativelanguage.googleapis.com/",
    },
  ])("$provider에 다른 공급자의 주소 $url을 허용하지 않는다", (setting) => {
    expect(() =>
      parseResumeModelSettingInput({ ...valid, ...setting }),
    ).toThrow(BadRequestException);
  });

  it.each([
    "",
    "  ",
    undefined,
    3,
    "a".repeat(4097),
    "key\nvalue",
    "key\rvalue",
    "key\0value",
  ])("API 키가 유효하지 않으면 BadRequestException을 던진다: %p", (apiKey) => {
    expect(() => parseResumeModelSettingInput({ ...valid, apiKey })).toThrow(
      BadRequestException,
    );
  });
  it("수정에서 API 키를 생략하면 키 변경 필드를 만들지 않는다", () => {
    const metadata = {
      environment: valid.environment,
      provider: valid.provider,
      modelName: valid.modelName,
      url: valid.url,
    };
    expect(
      parseResumeModelSettingInput(metadata, { requireApiKey: false }),
    ).toEqual(metadata);
  });
});
