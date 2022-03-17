const fs = require('fs')
const { display } = require('./BotService.js')
const FileHelper = require('../../Helpers/FileHelper.js')
const Youtube = require('./Youtube')

class MusicService {
  constructor() {
    this.servers = {}
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

    this.servers = require('../Server/Servers.json')

    return this.servers.find(s => s.id === serverId)
  }

  _restart(server, msg) {
    if(server.dispatcher !== null) {
      server.streamOptions.seek = server.dispatcher.streamTime / 1000
      server.dispatcher.destroy()
      server.dispatcher = null
    }

    this._trackStackManager(server, msg)
  }
  
  _getCurrentId(server, ctrl = {}) {
    if(ctrl.skip) {
      if(server.loops.track === server.currentId) {
        delete server.loops.track
      }

      return server.currentId + 1
    }

    if(Object.keys(server.loops).includes('track')
    && server.currentId === server.loops.track) {
      return server.currentId 
    }

    if(Object.keys(server.loops).includes('queue')
    && server.currentId === server.queueList.length - 1) {
      return 0
    }

    return server.currentId  + 1
  }

  _loopId(server, trackId) {
    trackId = trackId === "current"
      ? server.currentId
      : trackId - 1

    server.loops.track = trackId

    return `Track ${trackId + 1} is now in loop.`
  }

  _loopQueue(server) {
    server.loops.queue = true

    return "Queue is now in loop."
  }

  _disableLoops(server) {
    server.loops = {}

    return "All loops disabled."
  }

  async _connect(server, msg) {
    const { voice } = msg.member
    if(!voice.channelID) {
      throw "You must be connected to a voice channel to play a music!"
    }

    const { channel } = voice
    server.connection = await channel.join()
  }

  _clear(server) {
    server.currentId = 0
    server.queueList = []
    server.searchOptions = []
    server.streamOptions = {
      seek: 0,
      valume: 1
    }
    server.loops = {}

    if(server.dispatcher !== null) {
      server.dispatcher.destroy()
      server.dispatcher = null
    }
  }

  _playSound(stream, server, msg) {
    server.dispatcher = server.connection.play(stream, server.streamOptions)

    return new Promise((resolve, reject) => {
      server.dispatcher.on('error', (err) => {
        reject(err)
      }),
      server.dispatcher.on('finish', () => {
        server.dispatcher = null
        server.streamOptions.seek = 0

        resolve(true)
      })
    })
  }

  async _trackStackManager(server, msg) {
    try {
      if(!!server.dispatcher) {
        const index = server.queueList.length - 1 < 0
          ? 0
          : server.queueList.length - 1

        return `${server.queueList[index].name} added to queue.`
      }
  
      display(`Now playing: ${server.queueList[server.currentId].name}`, msg)
      const stream = await Youtube.getStream(server.queueList[server.currentId].url);
      await this._playSound(stream, server, msg)

      if(!!server.queueList[server.currentId + 1] 
      || !!Object.keys(server.loops).length) {
        server.currentId = this._getCurrentId(server)
        await this._trackStackManager(server, msg)
      }
    } catch(err) {
      console.error("An error has occurred. Retrying connection...\n", err)
      this._restart(server, msg)
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

  async _getMusic(server, args, msg) {
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
      if(!server.searchOptions.length || Number.isNaN(Number(args))) {
        server.searchOptions = []
        const options = await Youtube.search(args)

        server.searchOptions = options.items

        return {
          url: null,
          title: null,
          feedback: options.feedback
        }
      } 

      const item = server
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

  async play(id, msg, args) {
    try {
      const server = await this._getServerData(id)
      await this._connect(server, msg)
      const music = await this._getMusic(server, args, msg)

      if(!!music.feedback) {
        return music.feedback
      }
      
      server.searchOptions = []
      server.queueList.push({
        id: server.queueList.length,
        name: music.title,
        url: music.url
      })
  
      return this._trackStackManager(server, msg)
    } catch(e) {
      console.log("Error received: ", e)
      return e
    }
  }

  async loop(id, command) {
    const server = await this._getServerData(id)

    const loopOptions = {
      queue: () => this._loopQueue(server),
      disable: () => this._disableLoops(server)
    }

    const loopId = (/\d/gi.test(command) && !/\D/.test(command)) || command.toLowerCase() === "current"

    return loopId
      ? this._loopId(server, command)
      : !!loopOptions[command]
        ? loopOptions[command]()
        : "Command not recognized."
  }

  async skip(id, msg) {
    const server = await this._getServerData(id)
    await this._connect(msg)

    if(!server.queueList[server.currentId + 1]) {
      this._clear(server)
      return "No tracks left."
    }
    
    server.currentId = this._getCurrentId(server, { skip: true })
    server.streamOptions.seek = 0
    server.dispatcher = null

    return this._trackStackManager(server, msg);    
  }

  async queue(id) {
    const server = await this._getServerData(id)
    return !server.queueList.length
      ?  "No music in queue."
      : "\n" + server.queueList
      .reduce((list, item) => {
        return `${list} \n${1 + item.id}: ${item.name} ${
          item.id === server.currentId ? '[current]' : ''
        }`
      }, "")
  }

  async stop(id) {
    const server = await this._getServerData(id)
    this._clear(server)

    return "Stopped"
  }

  async leave(id, channel) {
    const server = await this._getServerData(id) 
    this._clear(server)
    await channel.leave()

    return `Left ${channel.name}`
  }

  async pause(id) {
    const server = await this._getServerData(id)
    if(!server.dispatcher) {
      return "Not playing any music right now."
    }

    server.dispatcher.pause()
    return "Paused"
  }

  async resume(id) {
    // Bugs node v16, use node v12
    const server = await this._getServerData(id)
    if(!server.dispatcher) {
      return "Not playing any music right now."
    }

    server.dispatcher.resume()
    return "Resume"
  }
}

module.exports = new MusicService