class BotService {
  static display(msgContent, msgInstance, markUser = false) {
    return markUser
      ? msgInstance.reply(msgContent)
      : msgInstance.channel.send(msgContent)
  }
}

module.exports = BotService