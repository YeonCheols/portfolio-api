import { ApiProperty, OmitType } from "@nestjs/swagger";
import { AdminResumeModelSettingCreateRequest } from "./resume-model-setting-create.dto";

export class AdminResumeModelSettingResponse extends OmitType(
  AdminResumeModelSettingCreateRequest,
  ["apiKey"] as const,
) {
  @ApiProperty({ example: true })
  hasApiKey: boolean;

  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: false })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
