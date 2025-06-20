import {
  Body,
  Controller,
  Post,
  Res,
  Get,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse } from "@nestjs/swagger";
import { AdminUserService } from "./user.service";
import {
  AdminCreateUserRequest,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminResetPasswordRequest,
} from "./dto";
import { Response, Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { GetUser } from "../auth/get-user.decorator";

@Controller("admin/user")
export class AdminUserController {
  constructor(private readonly userService: AdminUserService) {}

  // NOTE: 서버에서 자동으로 도메인 추출
  private extractDomain(req: Request): string | undefined {
    const origin = req.headers.origin;
    if (origin) {
      try {
        const url = new URL(origin);
        return url.hostname;
      } catch {
        // URL 파싱 실패 시 null 반환
      }
    }

    // Host 헤더에서 도메인 추출 (Origin이 없는 경우)
    const host = req.headers.host;
    if (host) {
      return host.split(":")[0]; // 포트 제거
    }

    // Referer 헤더에서 도메인 추출
    const referer = req.headers.referer;
    if (referer) {
      try {
        const url = new URL(referer);
        return url.hostname;
      } catch {
        // URL 파싱 실패 시 null 반환
      }
    }

    return undefined;
  }

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
    @Req() req: Request,
  ) {
    const { user, accessToken } = await this.userService.login(loginUserDto);

    const domain = this.extractDomain(req);
    const isLocalhost = domain === "localhost" || domain?.includes("localhost");
    const isHttps = req.headers["x-forwarded-proto"] === "https" || req.secure;

    console.info("domain : ", domain);
    console.info("isLocalhost : ", isLocalhost);
    console.info("isHttps : ", isHttps);

    const cookieOptions: any = {
      httpOnly: true, // JavaScript에서 접근 불가
      path: "/",
    };

    // 로컬호스트가 아닌 경우에만 도메인 설정
    if (domain) {
      cookieOptions.domain = domain;
    }

    // HTTPS 환경에서만 secure와 sameSite 설정
    if (isLocalhost && isHttps) {
      // 로컬 HTTPS 환경에서는 secure를 false로 설정 (브라우저 호환성)
      cookieOptions.secure = false;
      cookieOptions.sameSite = "lax";
    } else {
      // HTTP 환경에서는 sameSite를 lax로 설정
      cookieOptions.sameSite = "lax";
    }

    console.info("cookieOptions : ", cookieOptions);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    res.cookie("access_token", accessToken, cookieOptions);

    // 응답 본문에서는 토큰을 제거하고 사용자 정보만 반환
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
  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
    // 서버에서 자동으로 도메인 추출
    const domain = this.extractDomain(req);
    const isLocalhost = domain === "localhost" || domain?.includes("localhost");
    const isHttps = req.headers["x-forwarded-proto"] === "https" || req.secure;

    const cookieOptions: any = {
      httpOnly: true,
      path: "/",
    };

    // 로컬호스트가 아닌 경우에만 도메인 설정
    if (domain && !isLocalhost) {
      cookieOptions.domain = domain;
    }

    // HTTPS 환경에서만 secure와 sameSite 설정
    if (isLocalhost && isHttps) {
      // 로컬 HTTPS 환경에서는 secure를 false로 설정 (브라우저 호환성)
      cookieOptions.secure = false;
      cookieOptions.sameSite = "lax";
    } else if (isHttps) {
      // 프로덕션 HTTPS 환경
      cookieOptions.secure = true;
      cookieOptions.sameSite = "none";
    } else {
      // HTTP 환경에서는 sameSite를 lax로 설정
      cookieOptions.sameSite = "lax";
    }

    res.clearCookie("access_token", cookieOptions);
    return { message: "로그아웃 되었습니다." };
  }
}
