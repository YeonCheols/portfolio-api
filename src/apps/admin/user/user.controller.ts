import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

@Controller("admin/user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post("join")
  async join(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return { id: user.id, email: user.email };
  }

  @Post("login")
  async login(@Body() loginUserDto: LoginUserDto) {
    const user = await this.userService.findByEmail(loginUserDto.email);
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
