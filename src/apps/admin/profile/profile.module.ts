import { Module } from "@nestjs/common";
import { AdminProfileController } from "./profile.controller";
import { AdminProfileService } from "./profile.service";

@Module({
  controllers: [AdminProfileController],
  providers: [AdminProfileService],
})
export class AdminProfileModule {}
