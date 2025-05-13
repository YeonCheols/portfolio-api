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

  //Swagger 환경설정 연결
  setupSwagger(app);

  //Prisma 환경설정 연결
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);
}
void bootstrap();
