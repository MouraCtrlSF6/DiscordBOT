const fs = require('fs')

class FileLister {
  constructor(mainDir) {
    this.mainDir = mainDir
  }

  listAll(directory = this.mainDir) {
    const files = fs.readdirSync(directory)

    const listData = files.map(file => {
      const fileData = fs.statSync(`${directory}/${file}`)
      let filesInside = 'none'

      if(fileData.isDirectory()) 
        filesInside = this.listAll(`${directory}/${file}/`)

      return {
        name: file,
        isDirectory: fileData.isDirectory(),
        filesInside,
      }
    })

    return listData
  }

  listFilesOnDir(directory = this.mainDir) {
    const files = fs.readdirSync(directory)
    return files.filter(file => {
      const fileData = fs.statSync(`${directory}/${file}`)
      if(!fileData.isDirectory()) return file
    })
  }

  requireFilesOnDir(directory = this.mainDir) {
    const files = this.listFilesOnDir(directory)

    return files.map(file => `${path}/${file}`)
  }
}

const path = process.cwd()
module.exports = new FileLister(path)
