const MusicService = require('./Services/MusicService.js')
const CommandsService = require('../Services/Commands.js')

class Bot {
  constructor(client, msg, server) {
    this.server = server
    this.client = client
    this.msg = msg
    this.botId = this.client.user.id

    this.commandList = []
  }

  async _getCommands() {
    const { data: { data } } = await CommandsService.listAll()
    return data
  }

  list() {
    const msg = this.commandList.map(c => `${c.callable}: ${c.description}`)
    msg.sort((a, b) => {
      if(a.length > b.length || b.includes('--help')) 
        return 1
      if(a.length < b.length)
        return -1
      return 0
    })
    return '\n' + msg.join('\n');
  }

  queue() {
    return MusicService.queue(this.server)
  }

  play(args) {
    return MusicService.play(this.server, this.msg, args.join(' '))
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