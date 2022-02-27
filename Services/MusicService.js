const axios = require('axios')
const fs = require('fs')
const ytdl = require('ytdl-core');

class MusicService {
  constructor() {
    this.streamOptions = {
      seek: 0,
      volume: 1
    }
  }

  async play(client, msg, musicUrl) {
    const { voice } = msg.member
    if(!voice.channelID) {
      return "You must be connected to a voice channel to play a music!"
    }

    const { channel } = voice
    const connection = await channel.join()

    const stream = ytdl(musicUrl, { filter: 'audioonly' })
    const dispatcher = connection.play(stream, this.streamOptions)

    console.log(dispatcher)

    dispatcher.on('end', () => {
      channel.leave()
    })

    return 'Processing...'
  }
}

module.exports = new MusicService