import { PartialType } from "@nestjs/swagger";
import { AdminProjectCreateRequest } from "./create-project.dto";

export class AdminProjectUpdateRequest extends PartialType(
  AdminProjectCreateRequest
) {}
