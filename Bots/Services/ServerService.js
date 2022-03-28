const fs = require('fs')
const FileHelper = require('../../Helpers/FileHelper.js')

class ServerService {
  constructor() {
    this.servers = {}
  }

  serverData(serverId) {
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

  async connectChannel(server, msg) {
    const { voice } = msg.member
    if (!voice.channelID) {
      throw new Error("You must be connected to a voice channel to use this command!")
    }

    const { channel } = voice
    server.connection = await channel.join()
  }

  clear(server, option) {
    const forbiddenClears = ['id', 'name', 'dispatcher']
    const defaultStates = {
      currentId: 0,
      queueList: [],
      searchOptions: [],
      loops: {},
      streamOptions: {
        seek: 0,
        volume: 1
      },
      dispatcher: null
    }

    const clearOptions = {
      all: () => {
        if(!!server.dispatcher) {
          server.dispatcher.destroy();
        }

        Object.keys(defaultStates).forEach(key => {
          server[key] = defaultStates[key]
        })
      },
      dispatcher: () => {
        if(!!server.dispatcher) {
          server.dispatcher.destroy()
        }

        server.dispatcher = null
      }
   }

    Object.keys(server).forEach(key => {
      if(forbiddenClears.includes(key)) {
        return;
      }

      clearOptions[key] = () => {
        server[key] = defaultStates[key]
      }
    })

    return clearOptions[option]()
  }

  nextId(server, ctrl = {}) {
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

  dispatcher(server, value) {
    server.dispatcher = value
  }

  queueList(server, value) {
    server.queueList = value
  }

  currentId(server, value) {
    server.currentId = value
  }

  streamOptions(server, value) {
    server.streamOptions = value
  }

  createLoop(server, value) {
    server.loops = {
      ...server.loops,
      ...value
    }
  }

  searchOptions(server, value) {
    server.searchOptions = value
  }

  autoDeleteMessage(server, value) {
    server.autoDeleteMessage = value
  }
}

module.exports = new ServerService