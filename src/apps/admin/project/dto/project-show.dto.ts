import { ApiProperty } from "@nestjs/swagger";

export class AdminProjectStatusUpdateRequest {
  @ApiProperty({ description: "프로젝트 ID" })
  slug: string;
  @ApiProperty({ description: "프로젝트 노출 여부" })
  isShow: boolean;
}
