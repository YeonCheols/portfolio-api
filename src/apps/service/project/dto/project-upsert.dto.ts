import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { ProjectResponse } from "src/apps/public/project/dto";

export class ServiceProjectUpsertRequest {
  @ApiProperty({ description: "생성·업데이트를 식별하는 기존 프로젝트 slug" })
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
  @MaxLength(200)
  slug: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @ApiProperty()
  @IsString()
  @MaxLength(10000)
  description: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4096)
  image: string;

  @ApiProperty({
    description: "기존 계약과 같은 JSON 문자열 배열",
    example: '["TypeScript","NestJS"]',
  })
  @IsString()
  @MaxLength(10000)
  stacks: string;

  @ApiProperty({
    description: "PROJECT.MD 또는 AI가 보완한 자유 형식 마크다운",
  })
  @IsString()
  @MaxLength(262144)
  content: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/\S+)?$/)
  @MaxLength(4096)
  linkDemo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/\S+)?$/)
  @MaxLength(4096)
  linkGithub?: string | null;
}

export class ServiceProjectUpsertResponse {
  @ApiProperty({ enum: ["created", "updated", "unchanged"] })
  operation: string;

  @ApiProperty({ type: ProjectResponse })
  project: ProjectResponse;
}
