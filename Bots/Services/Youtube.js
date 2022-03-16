const ytdl = require('ytdl-core');
const ytsr = require('ytsr');

class Youtube {
  constructor() {}

  async search(args) {
    try {
      const { items } = await ytsr(args, { limit: 5 })
      const optionDisplay = items
        .map((item, index) => `${index + 1}. ${item.title}`)
  
      return {
        items: items,
        feedback: `Options:\n${optionDisplay.join('\n')}`
      }
    } catch(e) {
      throw e
    }
  }

  getStream(url) {
    return ytdl(url, { filter: 'audioonly', quality: 'highestaudio' })
  }
}

module.exports = new Youtube()
