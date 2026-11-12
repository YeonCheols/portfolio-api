import { ApiProperty } from "@nestjs/swagger";
import { ProjectTagResponse } from "./project-tag.dto";

export class ProjectResponse {
  @ApiProperty({ description: "프로젝트 ID" })
  id: number;
  @ApiProperty({ description: "프로젝트 제목" })
  title: string;
  @ApiProperty({ description: "프로젝트 슬러그" })
  slug: string;
  @ApiProperty({ description: "프로젝트 설명" })
  description: string;
  @ApiProperty({ description: "프로젝트 메인 이미지" })
  image: string;
  @ApiProperty({ description: "프로젝트 기술 스택" })
  stacks: string;
  @ApiProperty({ description: "프로젝트 상세 내용" })
  content: string;
  @ApiProperty({ description: "프로젝트 노출 여부" })
  isShow: boolean;
  @ApiProperty({ description: "프로젝트 데모 링크" })
  linkDemo: string;
  @ApiProperty({ description: "프로젝트 GitHub 링크" })
  linkGithub: string;
  @ApiProperty({ description: "프로젝트 정렬 순서" })
  order: number;
  @ApiProperty({ description: "프로젝트 업데이트 일자" })
  updatedAt: Date;
  @ApiProperty({
    description: "최근 7일 이내 생성되거나 실제 내용이 변경된 프로젝트 여부",
  })
  isRecent: boolean;
}

export class ProjectByTagResponse extends ProjectResponse {
  @ApiProperty({
    description: "프로젝트 태그",
    type: ProjectTagResponse,
    isArray: true,
  })
  projectTags: ProjectTagResponse[];
}
