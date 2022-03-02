const http = require('./Http')

class ServerService {
  constructor() {}

  listAll() {
    return http.get('/servers/index')
  }

  join(payload) {
    return http.post('/servers/store', payload)
  }

  leave(guild_id) {
    return http.delete(`/servers/remove/${guild_id}`)
  }
}

module.exports = new ServerService