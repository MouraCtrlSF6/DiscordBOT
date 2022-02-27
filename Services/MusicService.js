const ytdl = require('ytdl-core');
const { display } = require('../Services/BotService.js')

class MusicService {
  constructor() {
    this.streamOptions = {
      seek: 0,
      volume: 1
    }

    this.queueList = []
    this.currentId = 0
    this.dispatcher = null
  }

  getStream(id) {
    return ytdl(this.queueList[id].url, { filter: 'audioonly' })
  }

  playSong(stream, connection) {
    this.dispatcher = connection.play(stream, this.streamOptions)

    return new Promise((resolve, reject) => {
      this.dispatcher.on('error', (err) => {
        reject(err)
      }),
      this.dispatcher.on('finish', () => {
        this.dispatcher = null
        resolve(true)
      })
    })
  }

  async playerManager(connection, msg) {
    if(!this.dispatcher) {
      const stream = await this.getStream(this.currentId);

      this.playSong(stream, connection)
        .then(() => {
          if(!!this.queueList[this.currentId+1]) {
            this.currentId++
            display(`Now playing: ${this.queueList[this.currentId].name}`, msg)
            this.playerManager(connection, msg)
          }
          else {
            this.queueList = []
            display("All tracks were played!", msg)
          }
        })
        .catch((err) => {
          console.error("An error has ocurred: ", err)
          display("An error has ocurred.")
        })

        return `Now playing: ${this.queueList[this.currentId].name}`
    }

    return `${this.queueList[this.queueList.length - 1].name} added to queue.`
  }

  async play(msg, musicUrl) {
    const { voice } = msg.member
    if(!voice.channelID) {
      return "You must be connected to a voice channel to play a music!"
    }

    const { channel } = voice
    const connection = await channel.join()

    this.queueList.push({
      id: this.queueList.length,
      name: msg.embeds[0].title,
      url: musicUrl
    })

    return this.playerManager(connection, msg)
  }

  async pause() {
    if(!this.dispatcher) {
      return "Not playing any music right now."
    }

    this.dispatcher.pause()
    return "Paused"
  }

  async resume() {
    // Bugs
    if(!this.dispatcher) {
      return "Not playing any music right now."
    }

    this.dispatcher.resume()
    return "Resume"
  }

  queue() {
    return !this.queueList.length
      ?  "No music in queue."
      : "\n" + this.queueList
      .reduce((list, item) => {
        return `${list} \n${1 + item.id}: ${item.name} ${item.id === this.currentId ? '[current]' : ''}`
      }, "")
  }

  stop() {
    this.dispatcher.destroy()
    this.dispatcher = null
    this.queueList = []

    return "Stopped"
  }
}

module.exports = new MusicService