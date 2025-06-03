import { PartialType } from "@nestjs/swagger";
import { AdminProjectCreateRequest } from "./project-create.dto";

export class AdminProjectUpdateRequest extends PartialType(
  AdminProjectCreateRequest,
) {}
