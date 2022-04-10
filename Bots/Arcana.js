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
      const head = this.commandList.filter(command => [
        "--help", 
        "--play", 
        "--queue", 
        "--stop", 
        "--leave", 
        "--pause", 
        "--resume"
      ].includes(command.callable))
      head.sort((a, b) => {
        if(a.id > b.id || b.callable ===  "--help") {
          return 1
        } 
        if(a.id < b.id) {
          return -1
        }
        return 0
      })

      const body = this.commandList.filter(command => !head.includes(command))
      body.sort((a, b) => {
        if(a.description.length > b.description.length) {
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
        const pageCommands = [...head, ...body].slice(10 * page, (page + 1) * 10)
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
    try {
      args = args.join(' ')
      const subCommands = {
        queue: (value) => {
          return QueueService.play(this.server, this.msg, value)
        }
      } 
  
      if(args.includes(':')) {
        const [subCommand, value] = args.split(':')
  
        if(!!subCommands[subCommand]) {
          return subCommands[subCommand](value)
        }
      }
  
      return MusicService.play(this.server, args, this.msg, this.client)
    } catch(e) {
      throw e
    }
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
    return MusicService.leave(this.server)
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

  save(args) {
    return QueueService.save(this.server, this.msg, args.join(' '))
  }

  info(args) {
    return QueueService.info(this.server, this.msg, this.client, args.join(' '))
  }

  async exec() {
    try {
      this.commandList = await this._getCommands()
      const [ command, ...args ] = this.msg.content.split(' ')

      const target = this.commandList.find(c => c.callable === command)
      if(!target) {
        return "Command not found. Please, checkout the command list by typing --help."
      }
      return eval(target.exec)(args);
    } catch(e) {
      console.error(e.message)
      return e.message
    }
  }
}

module.exports = Bot