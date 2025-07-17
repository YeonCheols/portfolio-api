import { IsInt, IsOptional, Min, IsString } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { ProjectResponse } from "./project-get.dto";

export class ProjectSearchRequest {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size?: number = 10;
}

export class ProjectSearchResponse {
  @ApiProperty({
    description: "프로젝트 목록",
    type: ProjectResponse,
    isArray: true,
  })
  data: ProjectResponse[];
  @ApiProperty({ description: "프로젝트 총 개수" })
  total: number;
  @ApiProperty({ description: "현재 페이지" })
  page: number;
  @ApiProperty({ description: "페이지 당 프로젝트 수" })
  size: number;
}
