
const { MessageAttachment, MessageEmbed } = require('discord.js');

class BotService {
  
  static display(msgContent, msg) {
    try {
      return msg.channel.send(msgContent)
    } catch(e) {
      console.error(e.message)
    }
  }

  static reply(msgContent, msg) {
    try {
      return msg.reply(msgContent)
    } catch(e) {
      console.error(e.message)
    }
  }

  static autoDelete(msgContent, msg, server) {
    try {
      const embed = new MessageEmbed({
        title: msgContent,
        color: '#0085BD'
      })

      const bomb = msg.channel.send(embed)

      bomb 
        .then(result => {
          if(!!server.autoDeleteMessage) {
            server.autoDeleteMessage.delete()
          }
          server.autoDeleteMessage = result
        })
        .catch(err => {
          console.log("Error while sending message: ", err.message)
        })
  
      return bomb
    } catch(e) {
      console.error(e.message)
    }
  }

  static embedMessage(parameters, msg) {
    try {
      const embed = new MessageEmbed(parameters)
      return msg.channel.send(embed)
    } catch(e) {
      console.error(e.message)
    }
  }
}

module.exports = BotService