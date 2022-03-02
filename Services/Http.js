const axios = require('axios')

module.exports = axios.create({
    baseURL: process.env.BACK_URL,
    timeout: 1000 * 25,
})
