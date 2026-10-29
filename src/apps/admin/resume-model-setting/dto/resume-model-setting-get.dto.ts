import { ApiProperty } from "@nestjs/swagger";
import { AdminResumeModelSettingCreateRequest } from "./resume-model-setting-create.dto";

export class AdminResumeModelSettingResponse extends AdminResumeModelSettingCreateRequest {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: false })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
