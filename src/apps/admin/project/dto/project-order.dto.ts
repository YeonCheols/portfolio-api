import { ApiProperty } from "@nestjs/swagger";

export class AdminProjectOrderUpdateRequest {
  @ApiProperty({ 
    description: "교환할 첫 번째 프로젝트의 고유 식별자 (slug)",
    example: "project-1"
  })
  nextSlug: string;
  @ApiProperty({ 
    description: "첫 번째 프로젝트(nextSlug)가 이동할 새로운 순서 번호",
    example: 2
  })
  nextOrderNo: number;
  @ApiProperty({ 
    description: "교환할 두 번째 프로젝트의 고유 식별자 (slug)",
    example: "project-2"
  })
  prevSlug: string;
  @ApiProperty({ 
    description: "두 번째 프로젝트(prevSlug)가 이동할 새로운 순서 번호",
    example: 1
  })
  prevOrderNo: number;
}
