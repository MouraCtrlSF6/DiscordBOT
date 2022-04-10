const YoutubeService = require('./YoutubeService')
const TrackService = require('./TrackService')
const ServerService = require('./ServerService')
const QueueService = require('./QueueService')
const EmbedHelper = require('../../Helpers/EmbedHelper')

const { display, autoDelete } = require('./BotService.js')

class MusicService {
  constructor() {}

  _loopId(server, trackId) {
    trackId = trackId === "current"
        ? server.currentId
        : trackId - 1

    ServerService.createLoop(server, {
      track: trackId
    })

    return `Track ${trackId + 1} is now in loop.`
  }

  _loopQueue(server) {
    ServerService.createLoop(server, {
      queue: true
    })

    return "Queue is now in loop."
  }

  _disableLoops(server) {
    ServerService.clear(server, 'loops')

    return "All loops disabled."
  }

  _isURL(value) {
    try {
      const url = new URL(value)
      return true
    } catch {
      return false
    }
  }

  async _getSongs(server, args, msg, client) {
    try {
      if(!!this._isURL(args)) {
        if(!msg.embeds[0]) {
          throw "Sorry, can you repeat?"
        }

        if(YoutubeService.isPlaylist(args)) {
          const items = await YoutubeService.playlist(args)

          return {
            data: items,
            feedback: null
          }
        }
        
        const info = await YoutubeService.getInfo(msg.embeds[0].url)
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
          const feedbackOptions = {
            title: 'Options',
            thumbnailURL: `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png`
          }
          const options = await YoutubeService.search(args)
          ServerService.clear(server, 'searchOptions')
          ServerService.searchOptions(server, options)
          const feedback = EmbedHelper.create(feedbackOptions, options, server)
          
          return {
            data: [],
            feedback,
          }
        }

        const item = server
          .searchOptions
          .find((_, index) => index === Number(args) - 1)
        
        if(YoutubeService.isPlaylist(item.url)) {
          const items = await YoutubeService.playlist(item.url)

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
      throw e
    }
  }

  async seek(id, msg, args) {
    try {
      const server = await ServerService.serverData(id)
      await ServerService.connectChannel(server, msg)

      if(Number.isNaN(Number(args))){
        return "Provide the music id."
      }

      ServerService.clear(server, 'dispatcher')
      ServerService.clear(server, 'streamOptions')
      ServerService.currentId(server, Number(args) - 1)

      return TrackService.stackManager(server, msg)
    } catch(e) {
      console.log("Error received at seek: ", e.message)
      throw e
    }
  }

  async remove(id, msg, args) {
    try {
      const server = await ServerService.serverData(id)

      for(let id of args) {
        if(Number.isNaN(Number(id))) {
          return `Track id '${id}' is not valid.`
        }
      }

      args = args.map(id => Number(id))
      QueueService.remove(server, args)
      
      if(args.includes(server.currentId + 1)) {
        this._stopPlaying(server)
        display(`Tracks ${args} sucessfully removed from queue`, msg)

        return TrackService.stackManager(server, msg)
      }

      return `Tracks ${args} sucessfully removed from queue`
    } catch(e) {
      console.log("Error received at remove: ", e.message)
      throw e
    }
  }

  async play(id, args, msg, client) {
    try {
      const server = await ServerService.serverData(id)
      await ServerService.connectChannel(server, msg)
      const songs = await this._getSongs(server, args, msg, client)

      if (!!songs.feedback) {
        return autoDelete(songs.feedback, msg, server, 'options')
      }

      ServerService.clear(server, 'searchOptions')
      
      songs.data.forEach(song => {
        QueueService.push(server, {
          id: server.queueList.length,
          title: song.title,
          url: song.url,
          duration: song.duration
        })
      })

      return TrackService.stackManager(server, msg)
    } catch (e) {
      console.log("Error received at play: ", e.message)
      throw e
    }
  }

  async loop(id, command) {
    const server = await ServerService.serverData(id)

    if(!command) {
      return "Please, provide the loop option. Type '--help' for more information."
    }

    const loopOptions = {
      queue: () => this._loopQueue(server),
      disable: () => this._disableLoops(server)
    }

    const loopId = (/\d/gi.test(command) && !/\D/.test(command)) 
      || command.toLowerCase() === "current"

    return loopId
      ? this._loopId(server, command)
      : !!loopOptions[command]
        ? loopOptions[command]()
        : "Command not recognized."
  }

  async skip(id, msg) {
    const server = await ServerService.serverData(id)

    if (!server.queueList[server.currentId + 1]) {
      ServerService.clear(server, 'all')
      return "No tracks left."
    }

    ServerService.currentId(server, ServerService.nextId(server, { skip: true }))
    ServerService.clear(server, 'streamOptions')
    ServerService.clear(server, 'dispatcher')

    return TrackService.stackManager(server, msg);
  }

  async stop(id) {
    const server = await ServerService.serverData(id)
    ServerService.clear(server, 'all')

    return "Stopped"
  }

  async leave(id) {
    const server = await ServerService.serverData(id)
    
    if(!server.connection) {
      return "Not in a voice channel now."
    }
    ServerService.clear(server, 'all')
    const { channel } = server.connection
    await channel.leave()

    return `Left ${channel.name}`
  }

  async pause(id) {
    const server = await ServerService.serverData(id)
    if (!server.dispatcher) {
      return "Not playing any music right now."
    }

    server.dispatcher.pause()
    return "Paused"
  }

  async resume(id) {
    const server = await ServerService.serverData(id)
    if (!server.dispatcher) {
      return "Not playing any music right now."
    }

    server.dispatcher.resume()
    return "Resume"
  }
}

module.exports = new MusicService