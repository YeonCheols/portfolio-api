import { ApiProperty } from "@nestjs/swagger";
import { TagCategoryEnum } from "src/enum/category";

export class ProjectTagResponse {
  @ApiProperty({ description: "태그 ID" })
  id: number;

  @ApiProperty({ description: "태그 이름" })
  name: string;

  @ApiProperty({ description: "태그 아이콘" })
  icon: string;

  @ApiProperty({ description: "태그 색상" })
  color: string;

  @ApiProperty({
    description: "태그 카테고리",
    example: "frontend",
    enum: TagCategoryEnum,
  })
  category: TagCategoryEnum;

  @ApiProperty({ description: "업데이트 시간" })
  updatedAt: Date;
}
