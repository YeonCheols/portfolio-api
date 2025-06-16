import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

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

  async login(loginUserDto: LoginUserDto) {
    const user = await this.findByEmail(loginUserDto.email);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const isMatch = await bcrypt.compare(loginUserDto.password, user.password);
    if (!isMatch) throw new UnauthorizedException("Invalid credentials");

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" },
    );

    return { accessToken: token };
  }
}
