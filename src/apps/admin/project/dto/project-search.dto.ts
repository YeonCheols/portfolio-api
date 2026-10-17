import { IsInt, IsOptional, Min, IsString } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { AdminProjectResponse } from "../../../admin/project/dto/project-get.dto";

export class AdminProjectSearchRequest {
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

export class AdminProjectSearchResponse {
  @ApiProperty({
    description: "프로젝트 목록",
    type: AdminProjectResponse,
    isArray: true,
  })
  data: AdminProjectResponse[];
  @ApiProperty({ description: "프로젝트 총 개수" })
  total: number;
  @ApiProperty({ description: "검색 조건에 맞는 전체 프로젝트 개수" })
  filteredTotal: number;
  @ApiProperty({ description: "전체 프로젝트 개수" })
  allTotal: number;
  @ApiProperty({ description: "현재 페이지" })
  page: number;
  @ApiProperty({ description: "페이지 당 프로젝트 수" })
  size: number;
}
