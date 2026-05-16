import { BadRequestException } from '@nestjs/common';
import { IntercomSessionStatus } from '../../../common/enums';
import {
  assertIntercomTransition,
  isIntercomTerminal,
} from './intercom-session.machine';

describe('intercom-session.machine', () => {
  it('permite RINGING → ANSWERED', () => {
    expect(() =>
      assertIntercomTransition(
        IntercomSessionStatus.RINGING,
        IntercomSessionStatus.ANSWERED,
      ),
    ).not.toThrow();
  });

  it('rejeita ANSWERED → RINGING', () => {
    expect(() =>
      assertIntercomTransition(
        IntercomSessionStatus.ANSWERED,
        IntercomSessionStatus.RINGING,
      ),
    ).toThrow(BadRequestException);
  });

  it('identifica estados terminais', () => {
    expect(isIntercomTerminal(IntercomSessionStatus.ENDED)).toBe(true);
    expect(isIntercomTerminal(IntercomSessionStatus.RINGING)).toBe(false);
  });
});
