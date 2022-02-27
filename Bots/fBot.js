const MusicService = require('../Services/MusicService.js')

class Bot {
  constructor(client, msg) {
    this.client = client
    this.msg = msg
    this.botId = this.client.user.id

    this.commandList = [
      {
        id: 1,
        callable: '--help',
        description: 'Show all commands and their description',
        exec: () => this.list(),
      },
      {
        id: 2,
        callable: '--play',
        description: 'Play music provided as argument',
        exec: (args) => this.music(args),
      },
      {
        id: 3,
        callable: '--solve',
        description: 'Solves a simple mathematical expression',
        exec: (args) => this.solve(args),
      },
      {
        id: 4,
        callable: '--leave',
        description: 'Order BOT to leave the voice channel',
        exec: (args) => this.leave(args),
      }
    ]
  }

  list() {
    const msg = this.commandList.map(c => `${c.callable}: ${c.description}`)
    return '\n' + msg.join('\n');
  }

  music(musicUrl) {
    const data = MusicService.play(this.client, this.msg, ...musicUrl)
    return data
  }

  solve(args) {
    return eval(args.join(""))
  }

  leave() {
    const { voice } = this.msg.member
    const { channel } = voice

    channel.leave()
    return `Left ${channel.name}`
  } 

  exec() {
    const [ prefix, command, ...args ] = this.msg.content.split(' ')

    const { exec } = this.commandList.find(c => c.callable === command)
    return exec(args);
  }
}

module.exports = Bot