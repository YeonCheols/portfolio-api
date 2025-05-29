import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AdminProjectCreateRequest {
  @ApiProperty({
    description: "프로젝트 슬러그 (URL에 사용되는 고유 식별자)",
    example: "my-awesome-project",
  })
  slug: string;

  @ApiProperty({
    description: "프로젝트 제목",
    example: "나의 멋진 프로젝트",
  })
  title: string;

  @ApiProperty({
    description: "프로젝트 설명",
    example: "이 프로젝트는 정말 멋진 기능을 제공합니다.",
  })
  description: string;

  @ApiProperty({
    description: "프로젝트 이미지 URL",
    example: "https://example.com/image.jpg",
  })
  image: string;

  @ApiProperty({
    description: "사용된 기술 스택",
    example: "React, Node.js, TypeScript",
  })
  stacks: string;

  @ApiPropertyOptional({
    description: "프로젝트 상세 내용",
    example: "프로젝트에 대한 자세한 설명과 구현 내용...",
  })
  content?: string;

  @ApiPropertyOptional({
    description: "프로젝트 데모 링크",
    example: "https://example.com",
  })
  linkDemo?: string;

  @ApiPropertyOptional({
    description: "GitHub 리포지토리 링크",
    example: "https://github.com/username/project",
  })
  linkGithub?: string;

  @ApiPropertyOptional({
    description: "프로젝트 공개 여부",
    example: true,
    default: false,
  })
  isShow?: boolean;
}
