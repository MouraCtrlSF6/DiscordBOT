const ServerService = require('./ServerService')
const TrackService = require('./TrackService')
const YoutubeService = require('./YoutubeService')
const EmbedHelper = require('../../Helpers/EmbedHelper')
const UserQueueService = require('../../Services/UserQueue')
const { paginateAutoDelete, embed, paginate } = require('./BotService.js')

class QueueService {
  constructor() {}

  push(server, content) {
    try {
      ServerService.queueList(server, [
        ...server.queueList, 
        content
      ])
    } catch(e) {
      throw e
    }
  }

  _order(unordered) {
    return unordered.map((item, index) => {
      return {
        ...item,
        id: index
      }
    })
  }

  remove(server, ids) {
    try {
      const filtered = server
        .queueList
        .filter(track => !ids.includes(track.id + 1))
        
      ServerService.queueList(server, this._order(filtered))
    } catch(e) {
      throw e
    }
  }

  async show(id, msg, client) {
    try {
      const server = await ServerService.serverData(id)
      const calc = server.queueList.length / 10
      const totalPages = calc > parseInt(calc)
        ?  parseInt(calc) + 1
        : calc

      const embeds = Array.apply(null, Array(totalPages)).map((_, page) => {
        const pageSongs = server.queueList.slice(10 * page, (page + 1) * 10)
        const options = {
          title: 'Main queue',
          thumbnailURL: `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png`
        }
        return EmbedHelper.create(options, pageSongs, server)
      })  
  
      return !server.queueList.length
        ? "No music in queue."
        : paginateAutoDelete(embeds, msg, server, 'queue')
    } catch(e) {
      throw e
    }
  }

  async save(id, msg, args) {
    try {
      const server = await ServerService.serverData(id)
      if (!server.queueList.length) {
        return "No music in queue."
      }
      const infos = {
        user_id: msg.author.id,
        name: args
      }
      
      if(!args) {
        return "Please, provide queue's name."
      }
      const { data: { data: queue } } = await UserQueueService.listByName(infos)

      if(queue.length) {
        return "You already have a saved queue with this name."
      }

      await UserQueueService.create({
        data: JSON.stringify(server.queueList),
        user_id: infos.user_id,
        name: infos.name,
        size: server.queueList.length,
      })

      return "Queue added to your playlists!"
    } catch(e) {
      throw e
    }
  }

  async getTrackInfo(id, msg, client, track) {
    try {
      const server = await ServerService.serverData(id)

      if(!server.queueList.length) {
        return "No music in queue."
      }
      track = track === "current"
        ? server.currentId
        : track - 1

      if(!server.queueList[track]) {
        return "Track not found."
      }

      const trackInfo = await YoutubeService.getInfo(server.queueList[track].url)
      const formatedInformation = {
        blank: {
          "Artist": trackInfo.videoDetails.media.artist,
          "Album": trackInfo.videoDetails.media.album,
          "Song Duration": server.queueList[track].duration + "\n",
          "Url": server.queueList[track].url,
          "Arstist Channel": trackInfo.videoDetails.media.artist_url || "Not found",
        },
        text: server.queueList[track].isCurrent ? "[current]" : "[allocated on queue]"
      }
      const options = {
        title: trackInfo.videoDetails.media.song,
        imageURL: trackInfo.videoDetails.thumbnails[0].url,
        thumbnailURL: `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png`
      }

      const embeds = EmbedHelper.trackInfo(options, formatedInformation)
      return embed(embeds, msg)
    } catch(e) {
      throw e
    }
  }

  async getQueuesInfo(msg, client, name) {
    try {
      const infos = {
        user_id: msg.author.id,
        name,
      }

      if(!infos.name) {
        const { data: { data: queues } } = await UserQueueService.list(infos)

        if(!queues.length) {
          return "You don't have any saved queues at the moment."
        }
        const calc = queues.length / 5
        const pages = calc > parseInt(calc)
          ? parseInt(calc) + 1
          : calc

        const embeds = Array.apply(null, Array(pages)).map((_, page) => {
          const options = {
            title: `${msg.author.username}'s saved queues`,
            thumbnailURL: `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png`
          }
          const pageQueues = queues
            .slice(page * 10, (page + 1) * 10)
            .map((queue) => {
              const created_at = new Date(queue.created_at)
                .toLocaleDateString()
                .split('-')
                .reverse()
                .join('/')
              const updated_at = new Date(queue.updated_at)
                .toLocaleDateString()
                .split('-')
                .reverse()
                .join('/')

              const data = JSON.parse(queue.data)
              return {
                blank: queue.name,
                text: {
                  "Size": `${queue.size} songs`,
                  "Created at": created_at,
                  "Last modified": updated_at,
                  "First song": data[0].title,
                  "Last song": data[data.length - 1].title
                }
              }
            })
          return EmbedHelper.queueInfo(options, pageQueues)
        })

        return paginate(embeds, msg)
      }

      const { data: { data: queue } } = await UserQueueService.listByName(infos)

      if(!queue.length) {
        return `Queue ${infos.name} was not found.`
      }
      const calc = JSON.parse(queue[0].data).length / 10
      const pages = calc > parseInt(calc) 
        ? parseInt(calc) + 1 
        : calc
      const created_at = new Date(queue[0].created_at)
        .toLocaleDateString()
        .split('-')
        .reverse()
        .join('/')
      const updated_at = new Date(queue[0].updated_at)
        .toLocaleDateString()
        .split('-')
        .reverse()
        .join('/')

      const options = {
        title: infos.name,
        thumbnailURL: `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png`,
        description: `Size: ${queue[0].size} songs\nCreated at: ${created_at}\nLast modified: ${updated_at}`
      }
      const embeds = Array.apply(null, Array(pages)).map((_, page) => {
        const pageSongs = JSON.parse(queue[0].data).slice(page * 10, (page + 1) * 10)
        return EmbedHelper.create(options, pageSongs, {}, false)
      })

      return paginate(embeds, msg)
    } catch(e) {
      throw e
    }
  }

  async info(id, msg, client, args) {
    try {
      const infoOptions = {
        track: (value) => {
          return this.getTrackInfo(id, msg, client, value)
        }, 
        queues: (value) => {
          return this.getQueuesInfo(msg, client, value)
        }
      }

      if(!args) {
        return "Please, specify what information should be displayed."
      }
      const [ option, value ] = args.split(":")

      if(!Number.isNaN(Number(option)) || option === "current") {
        return infoOptions.track(option)
      }

      if(Object.keys(infoOptions).includes(option)) {
        return infoOptions[option](value)
      }

      return "Command not found. Please, checkout the command list by typing --help."
    } catch(e) {
      throw e
    }
  }

  async play(id, msg, queueName) {
    try {
      const server = await ServerService.serverData(id)
      await ServerService.connectChannel(server, msg)

      const infos = {
        user_id: msg.author.id,
        name: queueName
      }

      const { data: { data: queue } } = await UserQueueService.listByName(infos)
      
      if(!queue.length) {
        return `You currently don't have any saved queue named "${infos.name}"`
      }

      ServerService.clear(server, 'all')
      ServerService.queueList(server, JSON.parse(queue[0].data))
      ServerService.currentId(server, 0)
      
      return TrackService.stackManager(server, msg)
    } catch(e) {
      throw e
    }
  }

  async shuffle(id) {
    try {
      const server = await ServerService.serverData(id)
      const sampleQueue = JSON.parse(JSON.stringify(server.queueList))

      for (let i = 0; i < 5; i++) {
        sampleQueue.sort(() => {
          return Math.floor(Math.random() * 3) - 1
        })
      } 
      
      ServerService.queueList(server, this._order(sampleQueue))

      const actualTrack = server.queueList.find(track => track.isCurrent)

      ServerService.currentId(server, actualTrack.id)
      
      return "Shuffled"
    }
    catch(e) {
      console.log("Error on shuffle: ", e.message)
      throw e
    }
  }

  async add(id, msg, args) {
    try {
      if(!args.includes(':')) {
        return "Please, specify the saved queue's name."
      }
      args = args.split(":")
      const [ queueName, option ] = args
      const infos = {
        user_id: msg.author.id,
        name: queueName
      }

      const { data: { data: queue } } = await UserQueueService.listByName(infos)
      
      if(!queue.length) {
        return `You currently don't have any saved queue named "${infos.name}"`
      }

      const commands = {
        "queue": async() => {
          const server = await ServerService.serverData(id)
          let songList = JSON.parse(queue[0].data)
          songList.push(...server.queueList)
          songList = songList.map((song) => {
            return {
              ...song,
              isCurrent: false
            }
          })
          songList = this._order(songList)

          const payload = {
            ...queue[0],
            data: JSON.stringify(songList),
            size: songList.length
          }

          const response = await UserQueueService.update(infos, payload)
          return response.data.status === 200
            ? `Main queue successfully added to ${queue[0].name}!`
            : `An error has occurred. Please, try again later.`
        },
        "current": async() => {
          const server = await ServerService.serverData(id)
          const track = server.queueList[server.currentId]
          const songList = JSON.parse(queue[0].data)
          songList.push({ 
            ...track,
            id: queue[0].length,
            isCurrent: false
          })

          const payload = { 
            ...queue[0], 
            data: JSON.stringify(songList),
            size: queue[0].size + 1
          }

          const response = await UserQueueService.update(infos, payload)
          return response.data.status === 200
            ? `${track.title} successfully added to ${queue[0].name}!`
            : `An error has occurred. Please, try again later.`
        }
      }

      const trackId = async(track_id) => {  
        track_id -= 1
        if(Number.isNaN(Number(track_id))) {
          return "Please, provide a valid id"
        }

        const server = await ServerService.serverData(id)
        if(!server.queueList[track_id]) {
          return `Track ${track_id} was not found on queue.`
        }

        const track = server.queueList[track_id]
        const songList = JSON.parse(queue[0].data)
        songList.push({ 
          ...track,
          id: queue[0].length,
          isCurrent: false
        })
        const payload = { 
          ...queue[0], 
          data: JSON.stringify(songList),
          size: queue[0].size + 1
        }

        const response = await UserQueueService.update(infos, payload)

        return response.data.status === 200
          ? `${track.title} successfully added to ${queue[0].name}!`
          : `An error has occurred. Please, try again later.`
      }

      return Object.keys(commands).includes(option)
        ? commands[option]()
        : trackId(option)
    } catch(e) {
      throw e
    }
  }
}

module.exports = new QueueService