import { NAVIGATION_TEXTS, leaveSceneIfNavigation } from './scene-navigation.util';

function makeCtx(text: string) {
  return {
    message: { text },
    scene: { leave: jest.fn().mockResolvedValue(undefined) },
  } as any;
}

describe('scene-navigation util', () => {
  it('covers the user and admin keyboard buttons', () => {
    expect(NAVIGATION_TEXTS.has('📱в меню')).toBe(true);
    expect(NAVIGATION_TEXTS.has('📊 статистика')).toBe(true);
    expect(NAVIGATION_TEXTS.has('➕ Создать пользователя')).toBe(true);
  });

  it.each(['/start', '/admin', '📱в меню'])('leaves the scene and falls through for %s', async (text) => {
    const ctx = makeCtx(text);
    const next = jest.fn().mockResolvedValue(undefined);

    await expect(leaveSceneIfNavigation(ctx, next)).resolves.toBe(true);
    expect(ctx.scene.leave).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('keeps ordinary input inside the scene', async () => {
    const ctx = makeCtx('обычный ввод пользователя');
    const next = jest.fn();

    await expect(leaveSceneIfNavigation(ctx, next)).resolves.toBe(false);
    expect(ctx.scene.leave).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
