import { Context as BaseContext, Scenes } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';

export interface Context extends BaseContext {
  update: Update.CallbackQueryUpdate;
  session: SessionData;
  scene: Scenes.SceneContextScene<Context, MySceneSession>;
  match: any;
}

interface SessionData extends Scenes.SceneSession<MySceneSession> {
  messageId: number;
}

interface MySceneSession extends Scenes.SceneSessionData {
  state: {
    token?: string;
  };
}
