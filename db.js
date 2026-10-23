const { MongoClient } = require('mongodb')
const keys = require('./private/keys')

// one shared client for the whole app; bin/www calls connect() before listening
const client = new MongoClient(keys.mongoURI)
const db = client.db("GraphiteWriter")

module.exports = {
  client,
  db,
  connect: () => client.connect()
}
