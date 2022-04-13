const YoutubeService = require('../Bots/Services/YoutubeService')

class EmbedMaker {
  static genericHeader(options) {
    return {
      title: options.title || '',
      description: options.description || '',
      color: options.color || '#0099ff',
      thumbnail: {
        url: options.thumbnailURL
      },
    }
  }

  static create(options, items, server, current = true) {
    return {
      ...EmbedMaker.genericHeader(options),
      fields: items.map((song, index) => {
        const songId = Number.isNaN(Number(song.id))
          ? index + 1
          : song.id + 1

        const infos = YoutubeService.isPlaylist(song.url) 
          ? `PLAYLIST: ${song.length} songs.` 
          : `Song duration: ${song.duration}`

        return {
          name: `${songId}: ${song.title}`,
          value: `${infos}   ${server.queueList[song.id].isCurrent && current
            ? "[current]" 
            : ""
          }`,
          inline: false
        }
      }),
      image: {
        url: options.imageURL || ""
      }
    }
  }

  static queueInfo(options, item) {
    item = Array.isArray(item)
      ? item
      : [item]

    return {
      ...EmbedMaker.genericHeader(options),
      fields: item.map(queue => {
        return {
          name: queue.blank,
          value: Object.keys(queue.text).reduce((group, item) => {
            return group !== ''
              ? `${group}\n${item}: ${queue.text[item]}`
              : `${item}: ${queue.text[item]}`
          }, ''),
          inline: false
        }
      })
    }
  }

  static trackInfo(options, item) {
    item = Array.isArray(item) 
      ? item 
      : [item]

    return {
      ...EmbedMaker.genericHeader(options),
      fields: item.map((song) => {
        return {
          name: Object.keys(song.blank).reduce((group, item) => {
            return group !== ''
              ? `${group}\n${item}: ${song.blank[item]}`
              : `${item}: ${song.blank[item]}`
          }, ''),
          value: song.text || '.',
          inline: false
        }
      }),
      image: {
        url: options.imageURL || ""
      }
    }
  }

  static commandList(options, items) {
    return {
      ...EmbedMaker.genericHeader(options),
      fields: items.map((command) => {
        return {
          name: command.callable,
          value: command.description,
          inline: false
        }
      })
    }
  }
}

module.exports = EmbedMaker

