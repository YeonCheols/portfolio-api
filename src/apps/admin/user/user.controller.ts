import { Body, Controller, Post } from "@nestjs/common";
import { AdminUserService } from "./user.service";
import {
  AdminCreateUserDto,
  AdminLoginUserDto,
  AdminResetPasswordDto,
} from "./dto";

@Controller("admin/user")
export class AdminUserController {
  constructor(private readonly userService: AdminUserService) {}

  @Post("join")
  async join(@Body() createUserDto: AdminCreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return { id: user.id, email: user.email };
  }

  @Post("login")
  async login(@Body() loginUserDto: AdminLoginUserDto) {
    const { accessToken } = await this.userService.login(loginUserDto);
    return { accessToken };
  }

  @Post("reset-password")
  async resetPassword(@Body() resetPasswordDto: AdminResetPasswordDto) {
    const user = await this.userService.resetPassword(resetPasswordDto);
    return {
      response: user,
      message: "Password has been reset successfully",
    };
  }
}
