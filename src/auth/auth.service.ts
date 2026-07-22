import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    const { fullName, email, password, role } = signupDto;

    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.usersService.create({
      fullName,
      email,
      password: hashedPassword,
      role,
    });

    return {
      message: 'User registered successfully',
      user,
    };
  }

async login(loginDto: LoginDto) {
  const { email, password } = loginDto;

  const user = await this.usersService.findByEmail(email);

  if (!user) {
    throw new UnauthorizedException('Invalid email or password');
  }

  const isPasswordMatched = await bcrypt.compare(
    password,
    user.password,
  );

  if (!isPasswordMatched) {
    throw new UnauthorizedException('Invalid email or password');
  }

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = this.jwtService.sign(payload);

  return {
    message: 'Login successful',
    access_token: accessToken,
  };
}
}