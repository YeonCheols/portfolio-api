import { ApiProperty } from "@nestjs/swagger";
import { ResumeModelEnvironment, ResumeModelProvider } from "@prisma/client";

// 입력 검증은 resume-model-setting.policy.ts가 맡고 이 DTO는 문서화에만 쓴다
export class AdminResumeModelSettingCreateRequest {
  @ApiProperty({ enum: ResumeModelEnvironment, example: "production" })
  environment: ResumeModelEnvironment;

  @ApiProperty({ enum: ResumeModelProvider, example: "openrouter" })
  provider: ResumeModelProvider;

  @ApiProperty({ example: "anthropic/claude-sonnet-5.5" })
  modelName: string;

  @ApiProperty({ example: "https://openrouter.ai/api/v1/chat/completions" })
  url: string;

  @ApiProperty({
    description: "Secret Manager 시크릿 이름. 토큰 값은 넣지 않는다",
    example: "RESUME_MODEL_TOKEN_OPENROUTER",
  })
  secretRef: string;
}
