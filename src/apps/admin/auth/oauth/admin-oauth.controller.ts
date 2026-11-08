import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_MAX_AGE_MS,
  adminAuthCookieOptions,
} from "../admin-session";
import {
  AdminOAuthError,
  AdminOAuthProvider,
  adminAppRedirectUrl,
  isAdminOAuthProvider,
} from "./admin-oauth";
import { AdminOAuthService } from "./admin-oauth.service";

const requireProvider = (value: string): AdminOAuthProvider => {
  if (!isAdminOAuthProvider(value)) throw new NotFoundException();
  return value;
};

@ApiTags("Admin OAuth")
@Controller("admin/auth/oauth")
export class AdminOAuthController {
  constructor(private readonly service: AdminOAuthService) {}

  @Get(":provider/authorize")
  @ApiOperation({ summary: "관리자 OAuth 로그인 시작 (Google, GitHub)" })
  async authorize(
    @Param("provider") provider: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.service.getAuthorizationUrl(
      requireProvider(provider),
    );
    res.redirect(302, url);
  }

  @Get(":provider/callback")
  @ApiOperation({
    summary: "관리자 OAuth 완료: 등록된 관리자면 기존 관리자 쿠키를 발급",
  })
  async callback(
    @Param("provider") provider: string,
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response,
  ): Promise<void> {
    const validProvider = requireProvider(provider);
    if (query.error) {
      res.redirect(302, adminAppRedirectUrl("/login", "ACCESS_DENIED"));
      return;
    }
    if (!query.code || !query.state) {
      res.redirect(302, adminAppRedirectUrl("/login", "AUTH_FAILED"));
      return;
    }

    try {
      const { accessToken } = await this.service.signIn(
        validProvider,
        query.code,
        query.state,
      );
      res.cookie(ADMIN_ACCESS_TOKEN_COOKIE, accessToken, {
        ...adminAuthCookieOptions,
        maxAge: ADMIN_ACCESS_TOKEN_MAX_AGE_MS,
      });
      res.redirect(302, adminAppRedirectUrl("/"));
    } catch (error) {
      if (!(error instanceof AdminOAuthError)) throw error;
      res.redirect(302, adminAppRedirectUrl("/login", error.code));
    }
  }
}
