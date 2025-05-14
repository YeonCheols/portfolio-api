import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import { setupSwagger } from "../utils/swagger";

interface Error {
  code: string;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  app.listen(port).catch(async (err: Error) => {
    if (err.code === "EADDRINUSE") {
      console.log(`next port: ${port + 1}`);
      await app.listen(port + 1);
    } else {
      throw err;
    }
  });
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5001",
      "https://dev-ycseng.vercel.app",
      "https://ycseng.vercel.app",
      "https://dev-ycseng-admin.vercel.app",
      "https://ycseng-admin.vercel.app",
    ], // 허용할 오리진 배열
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
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
}
void bootstrap();
