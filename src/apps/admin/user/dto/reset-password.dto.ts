import { ApiProperty } from "@nestjs/swagger";

export class AdminResetPasswordRequest {
  @ApiProperty({ example: "admin@example.com" })
  email: string;

  @ApiProperty({ example: "password123" })
  newPassword: string;
}
