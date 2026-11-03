import { ApiProperty } from "@nestjs/swagger";
import { ResumeModelProvider } from "@prisma/client";

// 조회 전용 서비스 토큰으로 보호된 MCP 런타임 계약이다.
export class ResumeModelSettingActiveResponse {
  @ApiProperty({ enum: ResumeModelProvider, example: "openrouter" })
  provider: ResumeModelProvider;

  @ApiProperty({ example: "anthropic/claude-sonnet-5.5" })
  modelName: string;

  @ApiProperty({ example: "https://openrouter.ai/api/v1/chat/completions" })
  url: string;

  @ApiProperty({ description: "활성 모델 호출에 사용하는 실제 API 키입니다." })
  apiKey: string;
}
