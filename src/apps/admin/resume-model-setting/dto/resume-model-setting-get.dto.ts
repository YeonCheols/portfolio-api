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

// 목록은 연결 테스트를 위해 활성 여부와 관계없이 실제 키를 포함한다. 키가 없으면 null이다
export class AdminResumeModelSettingListItemResponse extends AdminResumeModelSettingResponse {
  @ApiProperty({
    type: String,
    nullable: true,
    example: "sk-or-v1-example",
  })
  apiKey: string | null;
}
