import { Module } from "@nestjs/common";
import { TagController } from "./tag.controller";
import { TagService } from "./tag.service";
import { PrismaService } from "src/prisma/prisma.service";

@Module({
  controllers: [TagController],
  providers: [TagService, PrismaService],
})
export class TagModule {}
