const ServerService = require('./ServerService')
const TrackService = require('./TrackService')
const EmbedHelper = require('../../Helpers/EmbedHelper')
const UserQueueService = require('../../Services/UserQueue')
const { paginateAutoDelete } = require('./BotService.js')

class QueueService {
  constructor() {}

  add(server, content) {
    try {
      ServerService.queueList(server, [
        ...server.queueList, 
        content
      ])
    } catch(e) {
      throw e
    }
  }

  remove(server, ids) {
    try {
      ServerService.queueList(server, server
        .queueList
        .filter(track => !ids.includes(track.id + 1))
        .map((item, index) => {
          return {
            ...item,
            id: index
          }
        })
      )
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
      throw e.message
    }
  }

  async info(id, msg, args) {
    try {
      const infoOptions = {
        current: () => {

        }, 
        queues: () => {

        },
        queueName: () => {

        },
        musicId: () => {

        }
      }

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
      ServerService.clear(server, 'all')
      ServerService.queueList(server, JSON.parse(queue[0].data))
      
      return TrackService.stackManager(server, msg)
    } catch(e) {
      throw e
    }
  }
}

module.exports = new QueueService