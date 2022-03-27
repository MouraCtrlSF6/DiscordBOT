const YoutubeService = require('../Bots/Services/YoutubeService')

class EmbedMaker {
  static create(options, items, server) {
    return {
      title: options.title || '',
      description: options.description || '',
      color: options.color || '#0099ff',
      thumbnail: {
        url: options.thumbnailURL
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
}

module.exports = EmbedMaker

