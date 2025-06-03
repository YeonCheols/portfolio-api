import { PartialType } from "@nestjs/swagger";
import { AdminProfileCreateRequest } from "./profile-create.dto";

export class AdminProfileUpdateRequest extends PartialType(
  AdminProfileCreateRequest,
) {}
