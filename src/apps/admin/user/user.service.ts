import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import {
  AdminCreateUserRequest,
  AdminLoginRequest,
  AdminResetPasswordRequest,
} from "./dto";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { getAdminJwtSecret } from "../auth/jwt-secret";

@Injectable()
export class AdminUserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: AdminCreateUserRequest) {
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

  async resetPassword(resetPasswordDto: AdminResetPasswordRequest) {
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

  async login(loginUserDto: AdminLoginRequest) {
    const user = await this.findByEmail(loginUserDto.email);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const isMatch = await bcrypt.compare(loginUserDto.password, user.password);
    if (!isMatch) throw new UnauthorizedException("Invalid credentials");

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      getAdminJwtSecret(),
      { expiresIn: "1d" },
    );
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
    });

    return {
      user: { id: user.id, email: user.email },
      accessToken: token,
    };
  }
}
