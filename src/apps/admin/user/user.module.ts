import { Module } from "@nestjs/common";
import { AdminUserService } from "./user.service";
import { AdminUserController } from "./user.controller";

@Module({
  controllers: [AdminUserController],
  providers: [AdminUserService],
})
export class AdminUserModule {}
