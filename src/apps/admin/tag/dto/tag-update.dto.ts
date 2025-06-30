import { PartialType } from "@nestjs/swagger";
import { AdminTagCreateRequest } from "./tag-create.dto";

export class AdminTagUpdateRequest extends PartialType(AdminTagCreateRequest) {}
