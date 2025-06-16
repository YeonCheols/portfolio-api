import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import * as bcrypt from "bcryptjs";

@Injectable()
export class AdminUserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.prisma.adminUser.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.adminUser.findUnique({ where: { email } });
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.findByEmail(resetPasswordDto.email);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    return this.prisma.adminUser.update({
      where: { email: resetPasswordDto.email },
      data: { password: hashedPassword },
    });
  }
}
