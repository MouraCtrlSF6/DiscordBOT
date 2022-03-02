const http = require('./Http')

class CommandsService {
  constructor() {}

  listAll() {
    return http.get('/commands/index')
  }
}

module.exports = new CommandsService