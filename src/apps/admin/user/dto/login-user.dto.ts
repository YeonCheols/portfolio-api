import { ApiProperty } from "@nestjs/swagger";

export class AdminLoginUserDto {
  @ApiProperty({ example: "admin@example.com" })
  email: string;

  @ApiProperty({ example: "password123" })
  password: string;
}
