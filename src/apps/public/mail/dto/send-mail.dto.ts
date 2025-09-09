import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class SendMailRequest {
  @ApiProperty({
    description: "수신자 이메일(미제공 시 기본값 사용)",
    example: "s9292909@gmail.com",
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: "메일 제목", example: "문의가 도착했습니다" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  subject: string;

  @ApiProperty({ description: "메일 HTML 내용", example: "<p>안녕하세요</p>" })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class SendMailResponse {
  @ApiProperty({ description: "성공 여부", example: true })
  success: boolean;
}
