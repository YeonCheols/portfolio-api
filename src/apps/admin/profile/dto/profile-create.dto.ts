import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AdminProfileCreateRequest {
  @ApiProperty({
    description: "프로필 이미지 URL",
    example: "https://example.com/profile.jpg",
  })
  imageUrl: string;

  @ApiPropertyOptional({
    description: "프로필 활성화 여부",
    example: true,
    default: true,
  })
  isActive?: boolean;
}
