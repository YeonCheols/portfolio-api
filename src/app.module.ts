import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectModule } from "./project/project.module";
import { PrismaErrorFilter } from "utils/error";
import { APP_FILTER } from "@nestjs/core";

@Module({
  imports: [PrismaModule, ProjectModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: PrismaErrorFilter,
    },
  ],
})
export class AppModule {}
