import { HomeScene } from '../scenes/home.scene';
import { QuestionScene } from '../scenes/question.scene';
import { CommandEnum } from '../enum/command.enum';

// The scene id must come from the @Scene() decorator, not from the shared
// ctx.scene.session.current — concurrent updates rewrite the latter mid-flight
// and the handler then renders another scene's screen (prod: 'scene.success is
// not a function', меню-клавиатура пропадала).
describe('AbstractScene.sceneId', () => {
  it('resolves each scene class to its own decorator id', () => {
    expect((new HomeScene() as any).sceneId).toBe(CommandEnum.HOME);
    expect((new QuestionScene() as any).sceneId).toBe(CommandEnum.QUESTION);
  });
});
