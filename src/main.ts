import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

interface Error {
  code: string;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle("Users API")
    .setDescription("The is a sample REST API")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  app.listen(port).catch(async (err: Error) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${port} is in use, trying next port...`);
      console.log(`next port: ${port + 1}`);
      await app.listen(port + 1);
    } else {
      throw err;
    }
  });

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);
}
void bootstrap();
