const TypeList = require('./type-list');
const ParseTypeError = require('./type-parser-error');
const log = require('debug')('command');
const Permission = require('./permission');

const NO_SUBCOMMAND = Symbol('NO_SUBCOMMAND');

class Command {
  constructor(labels, options = {}) {
    this.labels = Array.isArray(labels) ? labels : [labels];
    this._options = Object.assign(
      {
        guildOnly: false,
      },
      options
    );
    this.subcommands = [];

    this.permission({
      custom: () => true,
    });

    this.action(() => 'No action for this command.');

    this.argList = new TypeList();

    log('Constructed command %s', this.labels[0]);
  }

  add(cmd) {
    if (cmd instanceof Command === false)
      throw new Error(
        `\`cmd\` should be an instance of Command, got \`${cmd.toString()}\``
      );

    cmd.parent = this;
    this.subcommands.push(cmd);

    return cmd;
  }

  arg(...args) {
    this.argList.arg(...args);

    return this;
  }

  options(o = {}) {
    Object.assign(this._options, o);

    return this;
  }

  // Action
  action(fn) {
    this._action = fn;

    return this;
  }

  permission(p) {
    this._permission = new Permission(p);

    return this;
  }

  execute(msg, content) {
    // Check subcommands
    let result = this.parseSubcommands(msg, content);
    if (result !== NO_SUBCOMMAND) return result;

    log(
      '[%s] [%s] Parsing message args (%s)',
      this.labels[0],
      msg.id,
      content
    );

    let args = this.argList.parse(content, { msg, bot: global.bot });
    if (args instanceof ParseTypeError) return args;

    log(
      '[%s] [%s] Executing command with args %o',
      this.labels[0],
      msg.id,
      args
    );

    // execute command
    // Permission check
    if (this._permission.check(msg)) {
      return this._action(msg, args);
    } else {
      return 'You do not have permission to run this command.';
    }
  }

  parseSubcommands(msg, content) {
    let inGuild = msg.channel.guild ? true : false;

    log(
      '[%s] [%s] Parsing message for subcommands',
      this.labels[0],
      msg.id
    );

    content = content + ' ';

    // Find subcommand
    let label;
    let subcommand = this.subcommands.find(cmd => {
      log(
        '[%s] Checking label for subcommand %s',
        msg.id,
        cmd.labels[0]
      );

      // Find label

      // No guildOnly commands in dm channels
      if (cmd._options.guildOnly && inGuild === false) return false;

      label = cmd.labels.find(label =>
        content.startsWith(label + ' ')
      );
      return label ? true : false;
    });

    if (!subcommand) return NO_SUBCOMMAND;

    log('[%s] [%s] Got subcommand %s', this.labels[0], msg.id, label);

    // Remove label from content
    content = content.substr(label.length).trim();

    // Add parsed stuff to message
    msg.subcommands = (msg.subcommands || []).push({
      subcommand,
      label,
      content,
    });

    // execute command
    return subcommand.execute(msg, content);
  }

  parent() {
    return this.parent;
  }
}

module.exports = Command;