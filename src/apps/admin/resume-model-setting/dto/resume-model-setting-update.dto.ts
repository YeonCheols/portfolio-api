import { ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { AdminResumeModelSettingCreateRequest } from "./resume-model-setting-create.dto";

// 환경은 유지하며 API 키를 생략하면 기존 값을 보존한다.
export class AdminResumeModelSettingUpdateRequest extends OmitType(
  AdminResumeModelSettingCreateRequest,
  ["environment", "apiKey"] as const,
) {
  @ApiPropertyOptional({
    description: "교체할 실제 API 키입니다. 생략하면 기존 값을 유지합니다.",
    writeOnly: true,
    maxLength: 4096,
  })
  apiKey?: string;
}
