import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty({ example: "admin@example.com" })
  email: string;

  @ApiProperty({ example: "password123" })
  password: string;
}
