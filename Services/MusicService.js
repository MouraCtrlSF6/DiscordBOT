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

  _restart(connection, msg) {
    if(this.dispatcher !== null) {
      this.streamOptions.seek = this.dispatcher.streamTime / 1000
      this.dispatcher.destroy()
      this.dispatcher = null
    }

    this._playerManager(connection, msg)
  } 

  async _connect(msg) {
    const { voice } = msg.member
    if(!voice.channelID) {
      return "You must be connected to a voice channel to play a music!"
    }

    const { channel } = voice
    const connection = await channel.join()

    return {
      msg,
      connection
    }
  }

  _clear() {
    this.currentId = 0
    this.queueList = []

    if(this.dispatcher !== null) {
      this.dispatcher.destroy()
      this.dispatcher = null
    }
  }

  _getStream(id) {
    return ytdl(this.queueList[id].url, { filter: 'audioonly', quality: 'highestaudio' })
  }

  _playSong(stream, connection) {
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

  async _playerManager(connection, msg) {
    if(!this.dispatcher) {
      const stream = await this._getStream(this.currentId);

      this._playSong(stream, connection)
        .then(() => {
          if(!!this.queueList[this.currentId+1]) {
            this.currentId++
            display(`Now playing: ${this.queueList[this.currentId].name}`, msg)
            this._playerManager(connection, msg)
          }
          else {
            this._clear()
            display("All tracks were played!", msg)
          }
        })
        .catch((err) => {
          console.error("An error has occurred. Retrying connection...\n", err)
          this._restart(connection, msg)
        })

        return `Now playing: ${this.queueList[this.currentId].name}`
    }

    return `${this.queueList[this.queueList.length - 1].name} added to queue.`
  }

  async play(msg, musicUrl) {
    const { connection } = await this._connect(msg)

    if(!msg.embeds[0]) {
      return "Sorry, can you repeat please?"
    }

    this.queueList.push({
      id: this.queueList.length,
      name: msg.embeds[0].title,
      url: musicUrl
    })

    return this._playerManager(connection, msg)
  }

  async skip(msg) {
    const { connection } = await this._connect(msg)

    if(!this.queueList[this.currentId+1]) {
      this._clear()
      return "No tracks left."
    }

    this.currentId++;
    this.dispatcher = null
    return this._playerManager(connection, msg);    
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
    this._clear()

    return "Stopped"
  }

  leave(channel) { 
    this._clear()
    channel.leave()

    return `Left ${channel.name}`
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
}

module.exports = new MusicService