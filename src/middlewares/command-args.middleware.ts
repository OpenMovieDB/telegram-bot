export const commandArgs = () => (ctx, next) => {
  const isMessageUpdate = ctx.updateType === 'message';
  const hasTextMessage = isMessageUpdate && ctx.message.text;

  if (hasTextMessage && ctx.message.text.startsWith('/')) {
    const { command, args } = parseCommand(ctx.message.text);
    ctx.state.command = { raw: ctx.message.text, command, args };
  }

  return next();
};

const parseCommand = (text: string) => {
  const match = text.match(/^\/([^\s]+)\s?(.+)?/);

  if (!match) {
    return { command: null, args: [] };
  }

  const command = match[1];
  const args = match[2] ? match[2].split(' ') : [];

  return { command, args };
};
