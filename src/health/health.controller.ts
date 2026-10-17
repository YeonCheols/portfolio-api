import { Controller, Get, Header } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "앱 상태 확인 (DB 미조회)" })
  @ApiOkResponse({ schema: { example: { status: "ok" } } })
  check() {
    return this.healthService.check();
  }

  @Get("db")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "DB 연결 상태 확인" })
  @ApiOkResponse({
    schema: { example: { status: "ok", db: "up", latencyMs: 12 } },
  })
  @ApiServiceUnavailableResponse({
    schema: { example: { status: "error", db: "down" } },
  })
  checkDb() {
    return this.healthService.checkDb();
  }
}
