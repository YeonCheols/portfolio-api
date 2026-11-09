import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_MAX_AGE_MS,
  adminAuthCookieOptions,
} from "../admin-session";
import {
  ADMIN_OAUTH_APP_COOKIE,
  ADMIN_OAUTH_STATE_COOKIE,
  ADMIN_OAUTH_STATE_COOKIE_MAX_AGE_MS,
  AdminOAuthError,
  AdminOAuthProvider,
  adminAppRedirectUrl,
  adminOAuthStateCookieOptions,
  isAdminOAuthProvider,
  readCookie,
  resolveAdminAppUrl,
} from "./admin-oauth";
import { AdminOAuthService } from "./admin-oauth.service";

/** res.cookie가 URL 인코딩해 담은 값을 되돌린다. 깨진 값은 없는 것으로 본다. */
const decodeCookieValue = (value: string | undefined): string | undefined => {
  try {
    return value === undefined ? undefined : decodeURIComponent(value);
  } catch {
    return undefined;
  }
};

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
    @Query("app") app: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { url, state } = await this.service.getAuthorizationUrl(
      requireProvider(provider),
    );
    res.cookie(ADMIN_OAUTH_STATE_COOKIE, state, {
      ...adminOAuthStateCookieOptions,
      maxAge: ADMIN_OAUTH_STATE_COOKIE_MAX_AGE_MS,
    });
    // 시작한 관리자 앱 주소(로컬 관리자 등)를 콜백까지 들고 간다. 허용 범위 밖의 값은 기본 주소로 바뀐다
    res.cookie(ADMIN_OAUTH_APP_COOKIE, resolveAdminAppUrl(app), {
      ...adminOAuthStateCookieOptions,
      maxAge: ADMIN_OAUTH_STATE_COOKIE_MAX_AGE_MS,
    });
    res.redirect(302, url);
  }

  @Get(":provider/callback")
  @ApiOperation({
    summary: "관리자 OAuth 완료: 등록된 관리자면 기존 관리자 쿠키를 발급",
  })
  async callback(
    @Param("provider") provider: string,
    @Query() query: Record<string, string | undefined>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const validProvider = requireProvider(provider);
    const browserState = readCookie(
      req.headers.cookie,
      ADMIN_OAUTH_STATE_COOKIE,
    );
    // 쿠키에 담긴 값도 한 번 더 검증한다. 허용 범위 밖이면 기본 관리자 앱 주소가 된다
    const appUrl = resolveAdminAppUrl(
      decodeCookieValue(readCookie(req.headers.cookie, ADMIN_OAUTH_APP_COOKIE)),
    );
    // 일회용 state는 한 번 쓰고 끝나므로 결과와 상관없이 브라우저의 쿠키도 지운다
    res.clearCookie(ADMIN_OAUTH_STATE_COOKIE, adminOAuthStateCookieOptions);
    res.clearCookie(ADMIN_OAUTH_APP_COOKIE, adminOAuthStateCookieOptions);
    if (query.error) {
      res.redirect(302, adminAppRedirectUrl("/login", "ACCESS_DENIED", appUrl));
      return;
    }
    if (!query.code || !query.state || browserState !== query.state) {
      res.redirect(302, adminAppRedirectUrl("/login", "AUTH_FAILED", appUrl));
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
      res.redirect(302, adminAppRedirectUrl("/", undefined, appUrl));
    } catch (error) {
      if (!(error instanceof AdminOAuthError)) throw error;
      res.redirect(302, adminAppRedirectUrl("/login", error.code, appUrl));
    }
  }
}
