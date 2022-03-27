const MusicService = require('./Services/MusicService.js')
const QueueService = require('./Services/QueueService.js')
const CommandsService = require('../Services/Commands.js')
const EmbedHelper = require('../Helpers/EmbedHelper')

const { paginate } = require('../Bots/Services/BotService')

class Bot {
  constructor(client, msg, server) {
    this.server = server
    this.client = client
    this.msg = msg
    this.commandList = []
  }

  async _getCommands() {
    const { data: { data } } = await CommandsService.listAll()
    return data
  }

  list() {
    try {
      this.commandList.sort((a, b) => {
        if(a.description.length > b.description.length || b.callable ===  "--help") {
          return 1
        } 
        if(a.description.length < b.description.length) {
          return -1
        }
        return 0
      })
      const calc = this.commandList.length / 10
      const totalPages = calc > parseInt(calc)
        ?  parseInt(calc) + 1
        : calc
  
      const embeds = Array.apply(null, Array(totalPages)).map((_, page) => {
        const pageCommands = this.commandList.slice(10 * page, (page + 1) * 10)
        const options = {
          title: 'Command list',
          thumbnailURL: `https://cdn.discordapp.com/avatars/${this.client.user.id}/${this.client.user.avatar}.png`
        }
        return EmbedHelper.commandList(options, pageCommands)
      })  
  
      return paginate(embeds, this.msg)
    } catch(e) {
      throw e
    }
  }

  queue() {
    return QueueService.show(this.server, this.msg, this.client)
  }

  play(args) {
    return MusicService.play(this.server, args.join(' '), this.msg, this.client)
  }

  seek(args) {
    return MusicService.seek(this.server, this.msg, ...args)
  }

  remove(args) {
    return MusicService.remove(this.server, this.msg, args)
  }

  pause() {
    return MusicService.pause(this.server)
  }

  resume() {
    return MusicService.resume(this.server)
  }

  solve(args) {
    return eval(args.join(""))
  }

  leave() {
    const { voice } = this.msg.member
    const { channel } = voice

    return MusicService.leave(this.server, channel)
  } 

  stop() {
    return MusicService.stop(this.server)
  }

  skip() {
    return MusicService.skip(this.server, this.msg)
  }

  loop(args) {
    return MusicService.loop(this.server, ...args)
  }

  async exec() {
    this.commandList = await this._getCommands()
    const [ command, ...args ] = this.msg.content.split(' ')

    const { exec } = this.commandList.find(c => c.callable === command)
    return eval(exec)(args);
  }
}

module.exports = Bot