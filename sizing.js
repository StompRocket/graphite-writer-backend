const nlp = require("compromise")
const keys = require('./private/keys')
const fs = require("fs")
const docs = require("./private/documents.json")
const fetchMode = false
const MongoClient = require('mongodb').MongoClient;
var ProgressBar = require('progress');
var async = require("async");
var franc = require('franc')
let masterTopics = {}
let analytics = {
  largest: 0,
  average: 0,
  computed: 0
}
let done = 0
var bar = new ProgressBar(':percent :eta :bar :current/:total :elapsed ', {total: docs.length});
function bytes(s) {
  return ~-encodeURI(s).split(/%..|./).length
}
function jsonSize(s) {
  return bytes(JSON.stringify(s))
}

async.each(docs, (doc) => {
  // console.log(doc.title)
  let title = doc.title
  try {
    let data = JSON.parse(doc.data)
    let size = jsonSize(data)
    if (size > analytics.largest) {
      analytics.largest = size
    }
    analytics.average += size
    analytics.computed++
  } catch {

  }
  done++
  bar.tick()
})
analytics.average = analytics.average/analytics.computed
console.log(analytics)