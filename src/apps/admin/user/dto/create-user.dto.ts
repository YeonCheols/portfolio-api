import { ApiProperty } from "@nestjs/swagger";

export class AdminCreateUserRequest {
  @ApiProperty({ example: "admin@example.com" })
  email: string;

  @ApiProperty({ example: "password123" })
  password: string;
}
