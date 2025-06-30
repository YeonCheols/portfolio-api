import { Module } from "@nestjs/common";
import { AdminTagController } from "./tag.controller";
import { AdminTagService } from "./tag.service";
import { PrismaService } from "src/prisma/prisma.service";

@Module({
  controllers: [AdminTagController],
  providers: [AdminTagService, PrismaService],
})
export class AdminTagModule {}
