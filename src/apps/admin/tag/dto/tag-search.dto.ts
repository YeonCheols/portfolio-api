import { IsInt, IsOptional, Min, IsString } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { AdminTagResponse } from "./tag-get.dto";

export class AdminTagSearchRequest {
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

export class AdminTagSearchResponse {
  @ApiProperty({ type: [AdminTagResponse], description: "태그 목록" })
  data: AdminTagResponse[];

  @ApiProperty({ description: "현재 페이지 태그 수", example: 10 })
  total: number;

  @ApiProperty({ description: "전체 태그 수", example: 100 })
  allTotal: number;

  @ApiProperty({ description: "현재 페이지", example: 1 })
  page: number;

  @ApiProperty({ description: "페이지 크기", example: 10 })
  size: number;
}
