import { OmitType } from "@nestjs/swagger";
import { AdminResumeModelSettingCreateRequest } from "./resume-model-setting-create.dto";

// 환경은 생성 때 정하고 수정하지 않는다
export class AdminResumeModelSettingUpdateRequest extends OmitType(
  AdminResumeModelSettingCreateRequest,
  ["environment"] as const,
) {}
