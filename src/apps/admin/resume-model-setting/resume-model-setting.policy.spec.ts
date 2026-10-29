import { BadRequestException } from "@nestjs/common";
import { parseResumeModelSettingInput } from "./resume-model-setting.policy";

describe("parseResumeModelSettingInput", () => {
  const valid = {
    environment: "production",
    provider: "openrouter",
    modelName: "anthropic/claude-sonnet-5.5",
    url: "https://openrouter.ai/api/v1/chat/completions",
    secretRef: "RESUME_MODEL_TOKEN_OPENROUTER",
  };

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

  it.each(["openai", "", undefined])(
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

  it.each([
    "OTHER_TOKEN",
    "",
    "RESUME_MODEL_TOKEN/../DATABASE_URL",
    "RESUME_MODEL_TOKEN OPENROUTER",
    "projects/p/secrets/RESUME_MODEL_TOKEN/versions/latest",
    `RESUME_MODEL_TOKEN${"A".repeat(240)}`,
    undefined,
  ])("시크릿 이름이 %p이면 BadRequestException을 던진다", (secretRef) => {
    expect(() => parseResumeModelSettingInput({ ...valid, secretRef })).toThrow(
      BadRequestException,
    );
  });
});
