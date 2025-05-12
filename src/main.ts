import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 4000);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);
}
void bootstrap();
