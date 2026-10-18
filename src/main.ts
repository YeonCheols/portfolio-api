import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import { setupSwagger } from "../utils/swagger";
import * as fs from "fs";
import { INestApplication } from "@nestjs/common";
import { canAdvancePortOnConflict, resolveListenPort } from "./listen-port";

export async function bootstrap() {
  let app: INestApplication;
  const portFromEnv = process.env.PORT;
  let port = resolveListenPort(portFromEnv);

  // NOTE: 로컬 개발 환경에서 https 통신 목적
  if (
    fs.existsSync("./cert/local.ycseng.com-key.pem") &&
    fs.existsSync("./cert/local.ycseng.com.pem")
  ) {
    // HTTPS 옵션 설정
    const httpsOptions = {
      key: fs.readFileSync("./cert/local.ycseng.com-key.pem"),
      cert: fs.readFileSync("./cert/local.ycseng.com.pem"),
    };
    // NestJS 앱을 HTTPS 옵션과 함께 생성
    app = await NestFactory.create(AppModule, {
      httpsOptions,
    });
  } else {
    app = await NestFactory.create(AppModule);
  }

  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5001",
      "https://localhost:5001",
      "http://local.ycseng.com:5001",
      "https://local.ycseng.com:5001",
      "https://www.ycseng.com",
      "https://admin.ycseng.com",
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Origin,X-Requested-With,Content-Type,Accept,Authorization",
    exposedHeaders: ["Authorization"], // 응답에서 노출할 헤더
    credentials: true, // 인증 정보(쿠키 등) 허용
    maxAge: 3600, // preflight 요청 캐시(초)
    optionsSuccessStatus: 204, // OPTIONS 요청 응답 코드
  });

  //Swagger 환경설정 연결
  setupSwagger(app);

  //Prisma 환경설정 연결
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const strings = {
    ready: "[ \x1b[32mready\x1b[0m ]",
    http: "\x1b[43mHTTP\x1b[0m",
    https: "\x1b[44mHTTPS\x1b[0m",
  };

  // 서버 시작 (포트 충돌 시 자동으로 다음 포트 시도)
  try {
    await app.listen(port);
    console.info(
      `${strings.https}  ${strings.ready} on https://local.ycseng.com:${port}`,
    );
  } catch (error) {
    if (error.code === "EADDRINUSE" && canAdvancePortOnConflict(portFromEnv)) {
      port = port + 1;
      await app.listen(port);
      console.info(
        `${strings.https}  ${strings.ready} on http://local.ycseng.com:${port}`,
      );
    } else {
      throw error;
    }
  }
}
export async function startIfDirect(
  current: NodeJS.Module = module,
  entry: NodeJS.Module | undefined = require.main,
): Promise<void> {
  if (entry === current) {
    await bootstrap();
  }
}

void startIfDirect();
