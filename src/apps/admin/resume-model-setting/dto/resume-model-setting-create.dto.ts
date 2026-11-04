import { ApiProperty } from "@nestjs/swagger";
import { ResumeModelEnvironment, ResumeModelProvider } from "@prisma/client";

// 입력 검증은 resume-model-setting.policy.ts가 맡고 이 DTO는 문서화에만 쓴다
export class AdminResumeModelSettingCreateRequest {
  @ApiProperty({ enum: ResumeModelEnvironment, example: "production" })
  environment: ResumeModelEnvironment;

  @ApiProperty({
    enum: ResumeModelProvider,
    example: "openrouter",
    description: "OpenRouter, OpenAI, Gemini 모델 공급자입니다.",
  })
  provider: ResumeModelProvider;

  @ApiProperty({ example: "anthropic/claude-sonnet-5.5" })
  modelName: string;

  @ApiProperty({
    example: "https://openrouter.ai/api/v1/chat/completions",
    description:
      "공급자별 공식 HTTPS 호스트만 허용합니다: openrouter.ai, api.openai.com, generativelanguage.googleapis.com.",
  })
  url: string;

  @ApiProperty({
    description:
      "모델 공급자가 발급한 실제 API 키입니다. 응답 목록에는 반환하지 않습니다.",
    writeOnly: true,
    maxLength: 4096,
  })
  apiKey: string;
}
