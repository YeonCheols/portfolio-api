import { ApiProperty } from "@nestjs/swagger";

export class AdminProfileOrderUpdateRequest {
  @ApiProperty({
    description: "프로필 고유 ID",
    example: 1,
  })
  id: number;
  @ApiProperty({
    description: "프로필 정렬 번호",
    example: 1,
  })
  order: number;
}
