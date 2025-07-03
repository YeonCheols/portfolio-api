import { ApiProperty } from "@nestjs/swagger";
import { TagCategoryEnum } from "../../../../enum/category";

export class AdminTagCreateRequest {
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
}
