import { ApiProperty } from "@nestjs/swagger";

export class CreateProjectDto {
  @ApiProperty({
    description: "프로젝트의 고유 식별자",
    example: "my-awesome-project",
  })
  slug: string;

  @ApiProperty({
    description: "프로젝트 제목",
    example: "My Awesome Project",
  })
  title: string;

  @ApiProperty({
    description: "프로젝트 설명",
    example: "This is a description of my awesome project",
  })
  description: string;

  @ApiProperty({
    description: "프로젝트 대표 이미지 URL",
    example: "https://example.com/project-image.jpg",
  })
  image: string;

  @ApiProperty({
    description: "사용된 기술 스택",
    example: "React, Node.js, TypeScript",
  })
  stacks: string;

  @ApiProperty({
    description: "프로젝트 상세 내용",
    required: false,
    example: "Detailed project content in markdown format",
  })
  content?: string;

  @ApiProperty({
    description: "프로젝트 데모 링크",
    required: false,
    example: "https://demo.example.com",
  })
  link_demo?: string;

  @ApiProperty({
    description: "GitHub 저장소 링크",
    required: false,
    example: "https://github.com/username/project",
  })
  link_github?: string;

  @ApiProperty({
    description: "프로젝트 노출 여부",
    required: false,
    default: true,
    example: true,
  })
  is_show?: boolean;
}
