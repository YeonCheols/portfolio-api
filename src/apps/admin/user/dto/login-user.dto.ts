import { ApiProperty } from "@nestjs/swagger";

export class LoginUserDto {
  @ApiProperty({ example: "admin@example.com" })
  email: string;

  @ApiProperty({ example: "password123" })
  password: string;
}
