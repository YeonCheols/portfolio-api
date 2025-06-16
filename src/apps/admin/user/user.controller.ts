import { Body, Controller, Post } from "@nestjs/common";
import { AdminUserService } from "./user.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Controller("admin/user")
export class AdminUserController {
  constructor(private readonly userService: AdminUserService) {}

  @Post("join")
  async join(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return { id: user.id, email: user.email };
  }

  @Post("login")
  async login(@Body() loginUserDto: LoginUserDto) {
    const { accessToken } = await this.userService.login(loginUserDto);
    return { accessToken };
  }

  @Post("reset-password")
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const user = await this.userService.resetPassword(resetPasswordDto);
    return {
      response: user,
      message: "Password has been reset successfully",
    };
  }
}
