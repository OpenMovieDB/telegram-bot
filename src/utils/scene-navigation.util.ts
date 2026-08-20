import { Context } from '../interfaces/context.interface';
import { ADMIN_KEYBOARD_BUTTONS, BUTTONS } from '../constants/buttons.const';

// Every reply-keyboard text the global BotUpdate handlers route. Any scene
// text catch-all must yield these (and /commands) to the global handlers via
// next() — a press swallowed inside a scene strands the user until a pod
// restart.
export const NAVIGATION_TEXTS = new Set<string>([
  ...Object.values(BUTTONS).map((button) => button.text),
  ...Object.values(ADMIN_KEYBOARD_BUTTONS).map((button) => button.text),
]);

// Returns true when the update was a command or keyboard button: the scene is
// left and the update continues to the global handlers, so the press works on
// the first tap no matter which scene the user is in.
export const leaveSceneIfNavigation = async (ctx: Context, next: () => Promise<void>): Promise<boolean> => {
  const text: string = ctx.message?.['text'] ?? '';
  if (!text.startsWith('/') && !NAVIGATION_TEXTS.has(text)) return false;
  await ctx.scene.leave();
  await next();
  return true;
};
