import { ExceptionFilter, Catch, ArgumentsHost } from "@nestjs/common";
import { Prisma } from "../prisma/generated/client";

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErrorFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: any) => void };
    }>();

    if (exception.code === "P2002") {
      response.status(409).json({
        error: exception.message,
        message: "이미 존재하는 데이터입니다.",
      });
    } else if (exception.code === "P2025") {
      response.status(404).json({
        error: exception,
        message: "데이터를 찾을 수 없습니다.",
      });
    } else {
      response.status(500).json({ message: "internal server error" });
    }
  }
}
