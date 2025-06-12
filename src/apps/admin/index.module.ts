import { Module } from "@nestjs/common";
import { AdminProfileModule } from "./profile/profile.module";
import { AdminProjectModule } from "./project/project.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [AdminProfileModule, AdminProjectModule, UserModule],
})
export class AdminModule {}
