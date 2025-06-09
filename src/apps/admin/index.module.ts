import { Module } from "@nestjs/common";
import { AdminProfileModule } from "./profile/profile.module";
import { AdminProjectModule } from "./project/project.module";

@Module({
  imports: [AdminProfileModule, AdminProjectModule],
})
export class AdminModule {}
