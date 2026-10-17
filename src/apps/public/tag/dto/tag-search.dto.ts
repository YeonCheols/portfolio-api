import { IsInt, IsOptional, Min, IsString } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { TagResponse } from "./tag-get.dto";

export class TagSearchRequest {
  @ApiProperty({
    description: "검색 키워드",
    required: false,
    example: "React",
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({
    description: "페이지 번호",
    required: false,
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: "페이지당 항목 수",
    required: false,
    minimum: 1,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size?: number = 10;
}

export class TagSearchResponse {
  @ApiProperty({ type: [TagResponse], description: "태그 목록" })
  data: TagResponse[];

  @ApiProperty({ description: "현재 페이지 태그 수", example: 10 })
  total: number;

  @ApiProperty({ description: "검색 조건에 맞는 전체 태그 수", example: 42 })
  filteredTotal: number;

  @ApiProperty({ description: "전체 태그 수", example: 100 })
  allTotal: number;

  @ApiProperty({ description: "현재 페이지", example: 1 })
  page: number;

  @ApiProperty({ description: "페이지 크기", example: 10 })
  size: number;
}
