import {
  RequestUser,
  CondominiumMembershipContext,
} from '../common/interfaces/request-user.interface';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      condominiumMembership?: CondominiumMembershipContext;
    }
  }
}

export {};
