import {
  Body,
  Controller,
  Post,
  Res,
  Get,
  UseGuards,
  UseFilters,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse } from "@nestjs/swagger";
import { AdminUserService } from "./user.service";
import {
  AdminCreateUserRequest,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminResetPasswordRequest,
} from "./dto";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { GetUser } from "../auth/get-user.decorator";
import { AuthExceptionFilter } from "../auth/auth.exception.filter";

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
  async login(
    @Body() loginUserDto: AdminLoginRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken } = await this.userService.login(loginUserDto);

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      domain: ".ycseng.com",
      maxAge: 60 * 60 * 24 * 1000,
    });

    return { user };
  }

  @Post("reset-password")
  async resetPassword(@Body() resetPasswordDto: AdminResetPasswordRequest) {
    const user = await this.userService.resetPassword(resetPasswordDto);
    return {
      response: user,
      message: "Password has been reset successfully",
    };
  }

  @ApiBearerAuth("access-token")
  @UseGuards(JwtAuthGuard)
  @UseFilters(AuthExceptionFilter)
  @Get("auth/check")
  @ApiOkResponse({
    description: "토큰 유효성 검증 및 사용자 정보 조회",
  })
  authCheck(@GetUser() user) {
    return {
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  @ApiBearerAuth("access-token")
  @UseGuards(JwtAuthGuard)
  @UseFilters(AuthExceptionFilter)
  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      domain: ".ycseng.com",
    });
    return { message: "로그아웃 되었습니다." };
  }
}
