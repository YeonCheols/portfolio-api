import { ApiProperty } from "@nestjs/swagger";

export class AdminProfileResponse {
  @ApiProperty({ description: "프로필 ID", example: 1, })
  id: number;
  @ApiProperty({ description: "프로필 이미지 URL", example: "https://example.com/profile.jpg" })
  imageUrl: string;
  @ApiProperty({ description: "프로필 활성화 여부", example: true })
  isActive: boolean;
  @ApiProperty({ description: "프로필 순서", example: 1 })
  order: number;
  @ApiProperty({ description: "프로필 업데이트 일자", example: '2025-05-29 01:30:21.469' })
  updatedAt: Date;
}
