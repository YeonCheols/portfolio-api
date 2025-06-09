import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { ProfileService } from "./profile.service";
import { ProfileResponse } from "./dto/profile-get.dto";

@Controller("profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @ApiOperation({ summary: "프로필 조회" })
  @ApiOkResponse({
    description: "프로필 조회 성공",
    type: ProfileResponse,
    isArray: true,
  })
  @Get()
  findAll() {
    return this.profileService.findOne();
  }
}
