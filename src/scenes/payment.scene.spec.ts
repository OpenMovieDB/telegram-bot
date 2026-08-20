import { Test, TestingModule } from '@nestjs/testing';
import { PaymentScene } from './payment.scene';
import { PaymentService } from '../payment/payment.service';
import { TariffService } from '../tariff/tariff.service';
import { SessionStateService } from '../session/session-state.service';
import { BUTTONS } from '../constants/buttons.const';
import { CommandEnum } from '../enum/command.enum';

function makeCtx(text: string, overrides: Record<string, any> = {}) {
  return {
    from: { id: 42, username: 'tguser' },
    chat: { id: 42, type: 'private' },
    message: { text },
    session: {} as Record<string, any>,
    scene: {
      leave: jest.fn().mockResolvedValue(undefined),
      enter: jest.fn().mockResolvedValue(undefined),
    },
    reply: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('PaymentScene.onText', () => {
  let scene: PaymentScene;
  let sessionState: jest.Mocked<SessionStateService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentScene,
        { provide: PaymentService, useValue: {} },
        { provide: TariffService, useValue: {} },
        {
          provide: SessionStateService,
          useValue: {
            getPaymentFlags: jest.fn().mockResolvedValue(null),
            removePaymentFlags: jest.fn().mockResolvedValue(undefined),
            clearAllPaymentFlags: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    scene = module.get(PaymentScene);
    sessionState = module.get(SessionStateService);
  });

  // A press swallowed inside the scene strands the user until a pod restart —
  // commands and every real keyboard button must fall through to the global
  // handlers via next().
  it.each(['/start', BUTTONS[CommandEnum.HOME].text, BUTTONS[CommandEnum.GET_REQUEST_STATS].text])(
    'leaves the scene and falls through for %s',
    async (text) => {
      const ctx = makeCtx(text);
      const next = jest.fn().mockResolvedValue(undefined);

      await scene.onText(ctx as any, next);

      expect(ctx.scene.leave).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    },
  );

  it('nags for a valid email while waiting for one, without leaving the scene', async () => {
    sessionState.getPaymentFlags.mockResolvedValue({ waitingForEmail: true } as any);
    const ctx = makeCtx('не буду вводить почту');
    const next = jest.fn();

    await scene.onText(ctx as any, next);

    expect(ctx.reply).toHaveBeenCalledWith('Пожалуйста, введите корректный email адрес для получения чека.');
    expect(ctx.scene.leave).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('stays silent on free text when not waiting for email', async () => {
    const ctx = makeCtx('просто текст');
    const next = jest.fn();

    await scene.onText(ctx as any, next);

    expect(ctx.reply).not.toHaveBeenCalled();
    expect(ctx.scene.leave).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects home after a successful payment', async () => {
    sessionState.getPaymentFlags.mockResolvedValue({ shouldExitPaymentScene: true } as any);
    const ctx = makeCtx('любой текст');
    const next = jest.fn();

    await scene.onText(ctx as any, next);

    expect(sessionState.removePaymentFlags).toHaveBeenCalledWith(42);
    expect(ctx.scene.enter).toHaveBeenCalledWith(CommandEnum.HOME);
    expect(next).not.toHaveBeenCalled();
  });
});
