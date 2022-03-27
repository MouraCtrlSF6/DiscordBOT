const YoutubeService = require('./YoutubeService')
const TrackService = require('./TrackService')
const ServerService = require('./ServerService')

const { 
  display,
  autoDelete,
  embedMessage
} = require('./BotService.js')

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

        const infos = YoutubeService.isPlaylist(song.url) 
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
          const options = await YoutubeService.search(args)
          ServerService.clear(server, 'searchOptions')
          ServerService.searchOptions(server, options)

          const feedback = this._generateEmbeds(client, server, options, "Options")
          
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
      throw e.message
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
      console.log("Error received: ", e)
      return e
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

      ServerService.queueList(server, server
        .queueList
        .filter(track => !args.includes(track.id + 1))
        .map((item, index) => {
          return {
            ...item,
            id: index
          }
        })
      )
      
      if(args.includes(server.currentId + 1)) {
        this._stopPlaying(server)
        display(`Tracks ${args} sucessfully removed from queue`, msg)

        return TrackService.stackManager(server, msg)
      }

      return `Tracks ${args} sucessfully removed from queue`
    } catch(e) {
      console.log("Error received: ", e)
      return e
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
        ServerService.queueList(server, [
          ...server.queueList, 
          {
            id: server.queueList.length,
            title: song.title,
            url: song.url,
            duration: song.duration
          }
        ])
      })

      return TrackService.stackManager(server, msg)
    } catch (e) {
      console.log("Error received: ", e)
      return e
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
      this._clear(server)
      return "No tracks left."
    }

    ServerService.currentId(server, ServerService.nextId(server, { skip: true }))
    ServerService.clear(server, 'streamOptions')
    ServerService.clear(server, 'dispatcher')

    return TrackService.stackManager(server, msg);
  }

  async queue(id, msg, client) {
    const server = await ServerService.serverData(id)
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
    const server = await ServerService.serverData(id)
    this._clear(server)

    return "Stopped"
  }

  async leave(id, channel) {
    const server = await ServerService.serverData(id)
    this._clear(server)
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