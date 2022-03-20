const fs = require('fs')
const { display } = require('./BotService.js')
const FileHelper = require('../../Helpers/FileHelper.js')
const Youtube = require('./Youtube')

class MusicService {
  constructor() {
    this.server = {}
  }

  _getServerData(serverId) {
    const serverFiles = FileHelper.requireFilesOnDir('Bots/Server');
    if(!serverFiles.length) {
      fs.writeFile('./Bots/Server/Servers.json', JSON.stringify([]), (err) => {
        if(err) {
          console.error(err.message)
          throw err
        }
      })
    }

    const servers = require('../Server/Servers.json')
    this.server = servers.find((s) => s.id === serverId)
  }

  _restart(msg) {
    if(this.server.dispatcher !== null) {
      this.server.streamOptions.seek = this.server.dispatcher.streamTime / 1000
      this.server.dispatcher.destroy()
      this.server.dispatcher = null
    }

    this._trackStackManager(msg)
  }
  
  _getCurrentId(ctrl = {}) {
    if(ctrl.skip) {
      if(this.server.loops.track === this.server.currentId) {
        delete this.server.loops.track
      }

      return this.server.currentId + 1
    }

    if(Object.keys(this.server.loops).includes('track')
    && this.server.currentId === this.server.loops.track) {
      console.log("Track is in loop")
      return this.server.currentId 
    }

    if(Object.keys(this.server.loops).includes('queue')
    && this.server.currentId === this.server.queueList.length - 1) {
      return 0
    }

    return this.server.currentId  + 1
  }

  _loopId(trackId) {
    trackId = trackId === "current"
      ? this.server.currentId
      : trackId - 1

    this.server.loops.track = trackId

    return `Track ${trackId + 1} is now in loop.`
  }

  _loopQueue() {
    this.server.loops.queue = true

    return "Queue is now in loop."
  }

  _disableLoops() {
    this.server.loops = {}

    return "All loops disabled."
  }

  async _connect(msg) {
    const { voice } = msg.member
    if(!voice.channelID) {
      throw "You must be connected to a voice channel to play a music!"
    }

    const { channel } = voice
    this.server.connection = await channel.join()
  }

  _clear() {
    this.server.currentId = 0
    this.server.queueList = []
    this.server.searchOptions = []
    this.server.streamOptions = {
      seek: 0,
      valume: 1
    }
    this.server.loops = {}

    if(this.server.dispatcher !== null) {
      this.server.dispatcher.destroy()
      this.server.dispatcher = null
    }
  }

  _playSound(stream) {
    this.server.dispatcher = this.server.connection.play(stream, this.server.streamOptions)

    return new Promise((resolve, reject) => {
      this.server.dispatcher.on('error', (err) => {
        reject(err)
      }),
      this.server.dispatcher.on('finish', () => {
        this.server.dispatcher = null
        this.server.streamOptions.seek = 0

        resolve(true)
      })
    })
  }

  async _trackStackManager(msg) {
    try {
      if(!!this.server.dispatcher) {
        const index = this.server.queueList.length - 1 < 0
          ? 0
          : this.server.queueList.length - 1

        return `${this.server.queueList[index].name} added to queue.`
      }
  
      display(`Now playing: ${this.server.queueList[this.server.currentId].name}`, msg)
      const stream = await Youtube.getStream(this.server.queueList[this.server.currentId].url);
      await this._playSound(stream)

      if(!!this.server.queueList[this.server.currentId + 1] 
      || !!Object.keys(this.server.loops).length) {
        this.server.currentId = this._getCurrentId()
        await this._trackStackManager(msg)
      }
    } catch(err) {
      console.error("An error has occurred. Retrying connection...\n", err)
      this._restart(msg)
    }

    return "All tracks played!"
  }

  _isURL(value) {
    try {
      const url = new URL(value)
      return true
    } catch { 
      return false
    }
  }

  async _getMusic(msg, args) {
    if(!!this._isURL(args)) {
      if(!msg.embeds[0]) {
        throw "Sorry, can you repeat?"
      }

      return {
        title: msg.embeds[0].title,
        url:  msg.embeds[0].url
      }
    }
    else {
      if(!this.server.searchOptions.length || Number.isNaN(Number(args))) {
        console.log("music: ", args)
        this.server.searchOptions = []
        const options = await Youtube.search(args)

        this.server.searchOptions = options.items

        return {
          url: null,
          title: null,
          feedback: options.feedback
        }
      } 

      const item = this.server
        .searchOptions
        .find((i, index) => index === Number(args) - 1)

      return !!item
        ? {
          url: item.url,
          title: item.title,
          feedback: null
        }
        : {
          url: null,
          name: null,
          feedback: "Option not available"
        }
    }
  }

  async play(serverId, msg, args) {
    try {
      await this._getServerData(serverId)
      await this._connect(msg)
      console.log("SearchOptions: ", this.server.searchOptions)
      const music = await this._getMusic(msg, args)

      if(!!music.feedback) {
        return music.feedback
      }
      
      this.server.searchOptions = []
      this.server.queueList.push({
        id: this.server.queueList.length,
        name: music.title,
        url: music.url
      })
  
      return this._trackStackManager(msg)
    } catch(e) {
      console.log("Error received: ", e)
      return e.message
    }
  }

  async loop(serverId, command) {
    await this._getServerData(serverId)

    const loopOptions = {
      queue: () => this._loopQueue(),
      disable: () => this._disableLoops()
    }

    const loopId = (/\d/gi.test(command) && !/\D/.test(command)) || command.toLowerCase() === "current"

    return loopId
      ? this._loopId(command)
      : !!loopOptions[command]
        ? loopOptions[command]()
        : "Command not recognized."
  }

  async skip(serverId, msg) {
    await this._getServerData(serverId)
    await this._connect(msg)

    if(!this.server.queueList[this.server.currentId + 1]) {
      this._clear()
      return "No tracks left."
    }
    
    this.server.currentId = this._getCurrentId({ skip: true })
    this.server.streamOptions.seek = 0
    this.server.dispatcher = null
    return this._trackStackManager(msg);    
  }

  async queue(serverId) {
    await this._getServerData(serverId)
    return !this.server.queueList.length
      ?  "No music in queue."
      : "\n" + this.server.queueList
      .reduce((list, item) => {
        return `${list} \n${1 + item.id}: ${item.name} ${
          item.id === this.server.currentId ? '[current]' : ''
        }`
      }, "")
  }

  async stop(serverId) {
    await this._getServerData(serverId)
    this._clear()

    return "Stopped"
  }

  async leave(serverId, channel) {
    await this._getServerData(serverId) 
    this._clear()
    await channel.leave()

    return `Left ${channel.name}`
  }

  async pause(serverId) {
    await this._getServerData(serverId)
    if(!this.server.dispatcher) {
      return "Not playing any music right now."
    }

    this.server.dispatcher.pause()
    return "Paused"
  }

  async resume(serverId) {
    await this._getServerData(serverId)
    if(!this.server.dispatcher) {
      return "Not playing any music right now."
    }

    this.server.dispatcher.resume()
    return "Resume"
  }
}

module.exports = new MusicService