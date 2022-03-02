const MusicService = require('./Services/MusicService.js')
const CommandsService = require('../Services/Commands.js')

class Bot {
  constructor(client, msg) {
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
    return '\n' + msg.join('\n');
  }

  queue() {
    return MusicService.queue()
  }

  play(musicUrl) {
    return MusicService.play(this.msg, ...musicUrl)
  }

  pause() {
    return MusicService.pause()
  }

  resume() {
    return MusicService.resume()
  }

  solve(args) {
    return eval(args.join(""))
  }

  leave() {
    const { voice } = this.msg.member
    const { channel } = voice

    return MusicService.leave(channel)
  } 

  stop() {
    return MusicService.stop()
  }

  skip() {
    return MusicService.skip(this.msg)
  }

  async exec() {
    this.commandList = await this._getCommands()
    const [ command, ...args ] = this.msg.content.split(' ')

    const { exec } = this.commandList.find(c => c.callable === command)
    return eval(exec)(args);
  }
}

module.exports = Bot