import { Body, Controller, Post } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminUserService } from "./user.service";
import {
  AdminCreateUserRequest,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminResetPasswordRequest,
} from "./dto";

@Controller("admin/user")
export class AdminUserController {
  constructor(private readonly userService: AdminUserService) {}

  @Post("join")
  async join(@Body() createUserDto: AdminCreateUserRequest) {
    const user = await this.userService.create(createUserDto);
    return { id: user.id, email: user.email };
  }

  @ApiOkResponse({
    description: "로그인 성공",
    type: AdminLoginResponse,
  })
  @Post("login")
  async login(@Body() loginUserDto: AdminLoginRequest) {
    const { user, accessToken } = await this.userService.login(loginUserDto);
    return { user, accessToken };
  }

  @Post("reset-password")
  async resetPassword(@Body() resetPasswordDto: AdminResetPasswordRequest) {
    const user = await this.userService.resetPassword(resetPasswordDto);
    return {
      response: user,
      message: "Password has been reset successfully",
    };
  }
}
