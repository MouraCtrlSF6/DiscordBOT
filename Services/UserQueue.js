const http = require('./Http')

class UserQueueService {
  constructor() {}

  list(infos) {
    return http.get(`/queues/user/${infos.user_id}`)
  }

  listByName(infos) {
    return http.get(`/queues/user/${infos.user_id}/${infos.name}`)
  }

  add(payload) {
    return http.post('/queues/store', payload)
  }

  update(infos, payload) {
    return http.patch(`/queues/user/${infos.user_id}/${infos.name}`, payload)
  }

  remove(infos) {
    return http.delete(`/queues/user/${infos.user_id}/${infos.name}`)
  }
}

module.exports = new UserQueueService