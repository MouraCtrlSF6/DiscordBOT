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

  _generateEmbeds(client, server, items, title) {
    const thumbnailURL = `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png`
    
    return {
      title, 
      color: '#0099ff',
      thumbnail: {
        url: thumbnailURL
      }, 
      fields: items.map((song, index) => {
        const songId = Number.isNaN(Number(song.id))
          ? index + 1
          : song.id + 1

        const infos = Youtube.isPlaylist(song.url) 
          ? `PLAYLIST: ${song.length} songs.` 
          : `Song duration: ${song.duration}`
        
        return {
          name: `${songId}: ${song.title}`,
          value: `${infos}   ${server.currentId === song.id 
            ? "[current]" 
            : ""
          }`,
          inline: false
        }
      })
    }
  }

  async _getSongs(server, args, msg, client) {
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
          server.searchOptions = options

          const feedback = this._generateEmbeds(client, server, options, "Options")
          
          return {
            data: [],
            feedback,
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

  async play(id, args, msg, client) {
    try {
      const server = await this._getServerData(id)
      await this._connect(server, msg)
      const songs = await this._getSongs(server, args, msg, client)

      if (!!songs.feedback) {
        return autoDelete(songs.feedback, msg, server, 'options')
      }

      server.searchOptions = []
      
      songs.data.forEach(song => {
        server.queueList.push({
          id: server.queueList.length,
          title: song.title,
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
    const perPage = 10;
    const calc = server.queueList.length / perPage
    const totalPages = calc > parseInt(calc)
      ?  parseInt(calc) + 1
      : calc

    const embeds = Array.apply(null, Array(totalPages)).map((_, page) => {
      page += 1
      const pageSongs = server.queueList.slice(perPage * (page - 1), page * perPage)

      return this._generateEmbeds(client, server, pageSongs, 'Main queue')
    })  

    return !server.queueList.length
      ? "No music in queue."
      : embedMessage(embeds, msg)
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