import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  UnauthorizedException,
} from "@nestjs/common";
import { Response } from "express";

@Catch(UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: "인증에 실패했습니다. 로그인이 필요합니다",
      error: "unauthorized user",
    });
  }
}
