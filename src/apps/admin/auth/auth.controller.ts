// src/apps/admin/base-admin.controller.ts
import { UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "./jwt-auth.guard";

@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
export class AdminAuthController {}
