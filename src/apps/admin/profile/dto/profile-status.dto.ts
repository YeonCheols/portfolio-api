import { ApiProperty } from "@nestjs/swagger";

export class AdminProfileStatusUpdateRequest {
  @ApiProperty({
    description: "프로필 노출 여부",
    example: true,
  })
  isActive: boolean;
}
