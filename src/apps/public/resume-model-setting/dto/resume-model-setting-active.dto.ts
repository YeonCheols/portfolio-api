import { ApiProperty } from "@nestjs/swagger";
import { ResumeModelProvider } from "@prisma/client";

// MCP 계약: 토큰 값과 공급자별 messages 형식은 넣지 않는다
export class ResumeModelSettingActiveResponse {
  @ApiProperty({ enum: ResumeModelProvider, example: "openrouter" })
  provider: ResumeModelProvider;

  @ApiProperty({ example: "anthropic/claude-sonnet-5.5" })
  modelName: string;

  @ApiProperty({ example: "https://openrouter.ai/api/v1/chat/completions" })
  url: string;

  @ApiProperty({ example: "RESUME_MODEL_TOKEN_OPENROUTER" })
  secretRef: string;
}
