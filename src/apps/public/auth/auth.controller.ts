import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthServiceTokenGuard } from "./auth-service-token.guard";
import { AuthService } from "./auth.service";

type AuthClientId = "portfolio" | "mcp";
type ClientRequest = { client_id?: AuthClientId };

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get(".well-known/jwks.json")
  @ApiOperation({ summary: "공용 access token 서명 공개키 조회" })
  getJwks() {
    return this.service.getJwks();
  }

  @Post("authorize")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthServiceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "앱별 GitHub OAuth 시작 URL 및 일회용 state 생성" })
  authorize(@Body() body?: ClientRequest) {
    const clientId = this.requireClientId(body?.client_id);
    return this.service.createOAuthState(clientId);
  }

  @Post("callback")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthServiceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "GitHub OAuth 증명 확인 후 공용 사용자 토큰 발급" })
  callback(@Body() body?: ClientRequest & { code?: string; state?: string }) {
    const clientId = this.requireClientId(body?.client_id);
    if (!body?.code || !body.state)
      throw new BadRequestException("code와 state가 필요합니다.");
    return this.service.exchangeGitHubCode(clientId, body.code, body.state);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthServiceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "앱별 refresh token 회전" })
  refresh(@Body() body?: ClientRequest & { refresh_token?: string }) {
    const clientId = this.requireClientId(body?.client_id);
    if (!body?.refresh_token)
      throw new BadRequestException("refresh_token이 필요합니다.");
    return this.service.refresh(clientId, body.refresh_token);
  }

  @Post("revoke")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthServiceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "앱별 토큰 세션 폐기" })
  async revoke(@Body() body?: ClientRequest & { refresh_token?: string }) {
    const clientId = this.requireClientId(body?.client_id);
    if (!body?.refresh_token)
      throw new BadRequestException("refresh_token이 필요합니다.");
    await this.service.revoke(clientId, body.refresh_token);
    return { revoked: true };
  }

  private requireClientId(clientId?: string): AuthClientId {
    if (clientId !== "portfolio" && clientId !== "mcp") {
      throw new BadRequestException(
        "client_id는 portfolio 또는 mcp여야 합니다.",
      );
    }
    return clientId;
  }
}
