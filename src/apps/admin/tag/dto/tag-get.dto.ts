import { ApiProperty } from "@nestjs/swagger";
import { TagCategoryEnum } from "src/enum/category";

export class AdminTagResponse {
  @ApiProperty({ description: "태그 ID", example: 1 })
  id: number;

  @ApiProperty({ description: "태그 이름", example: "React" })
  name: string;

  @ApiProperty({ description: "아이콘", example: "react-icon" })
  icon: string;

  @ApiProperty({ description: "색상", example: "#61dafb" })
  color: string;

  @ApiProperty({
    description: "카테고리",
    example: "frontend",
    enum: TagCategoryEnum,
  })
  category: TagCategoryEnum;

  @ApiProperty({
    description: "업데이트 일자",
    example: "2025-06-30T00:00:00.000Z",
  })
  updatedAt: Date;
}
