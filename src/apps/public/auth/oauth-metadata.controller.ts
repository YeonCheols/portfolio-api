import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";

@ApiTags("Authentication")
@Controller()
export class OAuthMetadataController {
  constructor(private readonly service: AuthService) {}

  @Get(".well-known/oauth-authorization-server/auth")
  @ApiOperation({ summary: "OAuth authorization server well-known metadata" })
  oauthMetadata() {
    return this.service.getOAuthMetadata();
  }
}
