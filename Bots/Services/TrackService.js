const YoutubeService = require('./YoutubeService')
const ServerService = require('./ServerService')
const { autoDelete } = require('./BotService')

class TrackService {
  constructor() {}

  _playSound(stream, server) {
    server.dispatcher = server
      .connection
      .play(stream, server.streamOptions)

    return new Promise((resolve, reject) => {
      server.dispatcher.on('error', (err) => {
        reject(err)
      }),
      server.dispatcher.on('finish', () => {
        ServerService.clear(server, 'dispatcher')
        ServerService.clear(server, 'streamOptions')

        resolve(true)
      })
    })
  }

  _restart(server) {
    if (server.dispatcher !== null) {
      server.streamOptions.seek = server.dispatcher.streamTime / 1000
      ServerService.clear(server, 'dispatcher')
    }
  }

  async stackManager(server, msg, continuity = false) {
    try {
      if (!!server.dispatcher) {
        const index = server.queueList.length - 1 < 0
          ? 0
          : server.queueList.length - 1

        const embeds = {
          title: `${server.queueList[index].title} added to queue.`,
          color: '#0085BD'
        }
        
        return autoDelete(embeds, msg, server, 'added')
      }

      if(!continuity) {
        const embeds = {
          title: `Now playing: ${server.queueList[server.currentId].title}`,
          color: '#0085BD'
        }

        autoDelete(embeds, msg, server, 'playing')
      }
      const stream = await YoutubeService.getStream(server.queueList[server.currentId].url);
      await this._playSound(stream, server, msg)

      if (!!server.queueList[server.currentId + 1] || !!Object.keys(server.loops).length) {
        server.currentId = ServerService.nextId(server)
        await this.stackManager(server, msg)
      }
    } catch (err) {
      console.error("An error has occurred. Retrying connection...\n", err)
      this._restart(server)
      await this.stackManager(server, msg, true)
    }

    ServerService.clear(server, 'all')
    return "All tracks played!"
  }
}

module.exports = new TrackService