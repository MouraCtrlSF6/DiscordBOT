const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const ytpl = require('ytpl')

class Youtube {
  constructor() {}

  async search(args) {
    try {
      const { items } = await ytsr(args, { limit: 5 })
  
      return items
    } catch(e) {
      throw e
    }
  }

  async playlist(url) {
    try {
      const playlist = await ytpl(url)

      if(!playlist) {
        throw new Error("Playlist não encontrada.")
      }
    
      const { items } = playlist;
      return items.map(item => {
        return {
          title: item.title,
          url: item.url,
          duration: item.duration
        }
      })
    } catch(e) {
      throw e
    }
  }
  
  isPlaylist(url) {
    const validationSequence = [
      { 
        name: "body",
        description: "Verifies if url has playlist body.",
        message: "It's not a valid Youtube playlist.",

        isValid: (url) => {
          const re = /(http|https):\/\/.*(youtube|youtu.be).*(list|playlist).*/gi
          return re.test(url)
        },
      },
      { 
        name: "music",
        description: "Verifies if url is not a music from a playlist",
        message: "URL is a music from a Youtube playlist.",

        isValid: (url) => {
          const re = /.*(^((?!(index)).)*$)/gi
          return re.test(url)
        },
      }
    ]
    
    return !validationSequence.find(validation => !validation.isValid(url))
  }
  
  getStream(url) {
    return ytdl(url, { filter: 'audioonly', quality: 'highestaudio' })
  }

  getInfo(url) {
    return ytdl.getInfo(url, { download: false, limit: 1 })
  }
}

module.exports = new Youtube()
