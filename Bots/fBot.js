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
        exec: (args) => this.play(args),
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
        description: 'Order BOT to leave the voice channel and clears queue.',
        exec: (args) => this.leave(args),
      },
      {
        id: 5,
        callable: '--pause',
        description: 'Pauses teh current music.',
        exec: () => this.pause(),
      },
      {
        id: 6,
        callable: '--resume',
        description: 'Resumes the current music',
        exec: () => this.resume(),
      },
      {
        id: 7,
        callable: '--queue',
        description: 'Show tracks listed on queue',
        exec: () => this.queue(),
      },
      {
        id: 8,
        callable: '--stop',
        description: 'Stops the current music and clears the track queue',
        exec: () => this.stop(),
      },
      {
        id: 9,
        callable: '--skip',
        description: 'Skips to the next track on queue.',
        exec: () => this.skip(),
      },
    ]
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

  exec() {
    const [ command, ...args ] = this.msg.content.split(' ')

    const { exec } = this.commandList.find(c => c.callable === command)
    return exec(args);
  }
}

module.exports = Bot