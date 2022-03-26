const fs = require('fs')
const FileHelper = require('../../Helpers/FileHelper.js')
const Youtube = require('./Youtube')

const { 
  display,
  autoDelete,
  embedMessage
} = require('./BotService.js')

class MusicService {
  constructor() {
    this.servers = {}
  }

  _getServerData(serverId) {
    const serverFiles = FileHelper.requireFilesOnDir('Bots/Server');
    if (!serverFiles.length) {
      fs.writeFile('./Bots/Server/Servers.json', JSON.stringify([]), (err) => {
        if (err) {
          console.error(err.message)
          throw err
        }
      })
    }

    this.servers = require('../Server/Servers.json')

    return this.servers.find(s => s.id === serverId)
  }

  _restart(server) {
    if (server.dispatcher !== null) {
      server.streamOptions.seek = server.dispatcher.streamTime / 1000
      server.dispatcher.destroy()
      server.dispatcher = null
    }
  }

  _getCurrentId(server, ctrl = {}) {
    if (ctrl.skip) {
      if (server.loops.track === server.currentId) {
        delete server.loops.track
      }

      return server.currentId + 1
    }

    if (Object.keys(server.loops).includes('track')
      && server.currentId === server.loops.track) {
      return server.currentId
    }

    if (Object.keys(server.loops).includes('queue')
      && server.currentId === server.queueList.length - 1) {
      return 0
    }

    return server.currentId + 1
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
    if (!voice.channelID) {
      throw "You must be connected to a voice channel to play a music!"
    }

    const { channel } = voice
    server.connection = await channel.join()
  }

  _clear(server) {
    server.currentId = 0
    server.queueList = []
    server.searchOptions = []
    server.loops = {}
    this._stopPlaying(server)
  }

  _stopPlaying(server) {
    if(!!server.dispatcher) {
      server.dispatcher.destroy();
      server.dispatcher = null
    }
    server.streamOptions = {
      seek: 0,
      volume: 1
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

  async _trackStackManager(server, msg, continuity = false) {
    try {
      if (!!server.dispatcher) {
        const index = server.queueList.length - 1 < 0
          ? 0
          : server.queueList.length - 1

        autoDelete(`${server.queueList[index].name} added to queue.`, msg, server)
        return;
      }

      if(!continuity) {
        autoDelete(`Now playing: ${server.queueList[server.currentId].name}`, msg, server)
      }
      const stream = await Youtube.getStream(server.queueList[server.currentId].url);
      await this._playSound(stream, server, msg)

      if (!!server.queueList[server.currentId + 1]
        || !!Object.keys(server.loops).length) {
        server.currentId = this._getCurrentId(server)
        await this._trackStackManager(server, msg)
      }
    } catch (err) {
      console.error("An error has occurred. Retrying connection...\n", err)
      this._restart(server)
      await this._trackStackManager(server, msg, true)
    }

    this._clear(server)
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

  async _getSongs(server, args, msg) {
    try {
      if(!!this._isURL(args)) {
        if(!msg.embeds[0]) {
          throw "Sorry, can you repeat?"
        }
        
        const info = await Youtube.getInfo(msg.embeds[0].url)
        const time = new Date(null)

        time.setSeconds(info.videoDetails.lengthSeconds)

        const minutes = time.getMinutes() * (time.getHours() + 1)
        const seconds = time.getSeconds()

        const formatSeconds = seconds.toString().length < 2
          ? `0${seconds}`
          : seconds

        return {
          data: [{
            title: msg.embeds[0].title,
            url:  msg.embeds[0].url,
            duration: `${minutes}:${formatSeconds}`
          }],
          feedback: null
        }
      }
      else {
        if(!server.searchOptions.length || Number.isNaN(Number(args))) {
          server.searchOptions = []
          const options = await Youtube.search(args)
          server.searchOptions = options.items
  
          return {
            data: [],
            feedback: options.feedback
          }
        }

        const item = server
          .searchOptions
          .find((i, index) => index === Number(args) - 1)
        
        if(Youtube.isPlaylist(item.url)) {
          const items = await Youtube.playlist(item.url)

          return {
            data: items,
            feedback: null
          }
        }
  
        return !!item
          ? {
            data: [{
              url: item.url,
              title: item.title,
              duration: item.duration
            }],
            feedback: null
          }
          : {
            data: [],
            feedback: "Option not available"
          }
      }
    } catch(e) {
      throw e.message
    }
  }

  async seek(id, msg, args) {
    try {
      const server = await this._getServerData(id)
      await this._connect(server, msg)

      if(Number.isNaN(Number(args))){
        return "Provide the music id."
      }

      this._stopPlaying(server);

      server.currentId = Number(args) - 1
      
      return this._trackStackManager(server, msg)
    } catch(e) {
      console.log("Error received: ", e)
      return e
    }
  }

  async remove(id, msg, args) {
    try {
      const server = await this._getServerData(id)
      await this._connect(server, msg)

      for(let id of args) {
        if(Number.isNaN(Number(id))) {
          return `Track id '${id}' is not valid.`
        }
      }

      args = args.map(id => Number(id))
      server.queueList = server.queueList.filter(track => !args.includes(track.id + 1))
      server.queueList = server.queueList.map((item, index) => {
        return {
          ...item,
          id: index
        }
      })
      
      if(args.includes(server.currentId + 1)) {
        this._stopPlaying(server)
        display(`Tracks ${args} sucessfully removed from queue`, msg)

        return this._trackStackManager(server, msg)
      }

      return `Tracks ${args} sucessfully removed from queue`
    } catch(e) {
      console.log("Error received: ", e)
      return e
    }
  }

  async play(id, msg, args) {
    try {
      const server = await this._getServerData(id)
      await this._connect(server, msg)
      const songs = await this._getSongs(server, args, msg)

      if (!!songs.feedback) {
        return songs.feedback
      }

      server.searchOptions = []
      
      songs.data.forEach(song => {
        server.queueList.push({
          id: server.queueList.length,
          name: song.title,
          url: song.url,
          duration: song.duration
        })
      })

      return this._trackStackManager(server, msg)
    } catch (e) {
      console.log("Error received: ", e)
      return e
    }
  }

  async loop(id, command) {
    const server = await this._getServerData(id)

    if(!command) {
      return "Please, provide the loop option. Type '--help' for more information."
    }

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
    await this._connect(server, msg)

    if (!server.queueList[server.currentId + 1]) {
      this._clear(server)
      return "No tracks left."
    }

    server.currentId = this._getCurrentId(server, { skip: true })
    server.streamOptions.seek = 0
    server.dispatcher = null

    return this._trackStackManager(server, msg);
  }

  async queue(id, msg, client) {
    const server = await this._getServerData(id)
    const embed = {
      title: 'Main queue',
      color: '#0099ff',
      thumbnail: {
        url: `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png`
      },  
      fields: server.queueList.map(song => {
        return {
          name: `${song.id + 1}: ${song.name} ${server.currentId === song.id 
            ? "[current]" 
            : ""
          }`,
          value: `Song duration: ${song.duration}`,
          inline: false
        }
      })
    }

    return !server.queueList.length
      ? "No music in queue."
      : embedMessage(embed, msg)
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
    if (!server.dispatcher) {
      return "Not playing any music right now."
    }

    server.dispatcher.pause()
    return "Paused"
  }

  async resume(id) {
    const server = await this._getServerData(id)
    if (!server.dispatcher) {
      return "Not playing any music right now."
    }

    server.dispatcher.resume()
    return "Resume"
  }
}

module.exports = new MusicService