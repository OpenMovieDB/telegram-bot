import { Context as BaseContext, Scenes } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';

export interface Context extends BaseContext {
  update: Update.CallbackQueryUpdate;
  session: SessionData;
  scene: Scenes.SceneContextScene<Context, SceneSession>;
  match: any;
}

interface SessionData extends Scenes.SceneSession<SceneSession> {
  messageId: number;
}

interface SceneSession extends Scenes.SceneSessionData {
  state: {
    token?: string;
  };
}
