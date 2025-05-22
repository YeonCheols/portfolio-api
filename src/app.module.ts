import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { PublicModule } from "./apps/public/index.module";
import { AdminModule } from "./apps/admin/index.module";
import { PrismaErrorFilter } from "../utils/error";

@Module({
  imports: [PrismaModule, PublicModule, AdminModule],
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
