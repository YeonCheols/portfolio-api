import { Prisma, ResumeModelProvider } from "@prisma/client";

describe("이력서 모델 공급자 Prisma 스키마", () => {
  it("기존 OpenRouter와 OpenAI·Gemini를 같은 enum으로 제공한다", () => {
    expect(Object.values(ResumeModelProvider)).toEqual([
      "openrouter",
      "openai",
      "gemini",
    ]);
    const setting = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "ResumeModelSetting",
    );
    expect(
      setting?.fields.find((field) => field.name === "provider"),
    ).toMatchObject({
      kind: "enum",
      type: "ResumeModelProvider",
      isRequired: true,
    });
  });
});
