import { ApiProperty } from "@nestjs/swagger";

export class AdminLoginRequest {
  @ApiProperty({ example: "admin@example.com" })
  email: string;

  @ApiProperty({ example: "password123" })
  password: string;
}

export class AdminLoginResponse {
  @ApiProperty({
    example: {
      id: 1,
      email: "admin@example.com",
    },
  })
  user: {
    id: number;
    email: string;
  };
}
