import { SetMetadata } from '@nestjs/common';
import { Role } from '../../users/user.entity';

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);