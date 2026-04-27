import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CondominiumMembershipContext } from '../interfaces/request-user.interface';

export const CondominiumMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CondominiumMembershipContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.condominiumMembership as CondominiumMembershipContext;
  },
);
