const nlp = require("compromise")
const keys = require('./private/keys')
const fs = require("fs")
const docs = require("./private/documents.json")
const MongoClient = require('mongodb').MongoClient;
var ProgressBar = require('progress');
var async = require("async");
var franc = require('franc')
var analyics = {
  maxWords: 0,
  tooLittle: 0,
  tooMuch: [],
  tooMuchDocs: [],
  notEnglish: 0,
  languages: {}
}
function convertDeltaToText(delta) {
  let string = ""
  try {
    delta = JSON.parse(delta)
    delta.ops.forEach(ops => {

      if (typeof ops.insert == "string") {
        string += ops.insert
      }

    })
  } catch {
    string = ""
  }
  return string
}

let masterTopics = {}
let done = 0
var bar = new ProgressBar(':percent :eta :bar :current/:total :elapsed ', { total: docs.length});
async.each(docs, (doc) => {
  // console.log(doc.title)
  let title = doc.title

  let text = convertDeltaToText(doc.data)
  let language = franc(text)
  if (language == "eng") {
    // console.log("converted")
    let topics = []
    nlp(title).topics().unique().json().forEach(topic => {
      topics.push(topic)
    })
    // console.log("got title topics")
    let nlpDoc = nlp(text)
    let wordCount = nlpDoc.wordCount()
    // console.log("into nlpDoc", nlpDoc.wordCount())
    if (wordCount > 12000) {
      // console.log("wordcount max")
      analyics.maxWords ++
      analyics.tooMuchDocs.push({id: doc["_id"], count: wordCount, owner: doc.owner})

      analyics.tooMuch.push(wordCount)
    } else if(wordCount < 3 ) {
      analyics.tooLittle ++
    } else {
      nlpDoc.topics().unique().json().forEach(topic => {topics.push(topic)})
      // console.log("got text topics")
    }



    if (topics.length > 0) {
      //  console.log(topics, "topics")
      topics.forEach(topic => {
        // console.log(topic)
        if (topic.text) {
          let normalized = nlp(topic.text.toLowerCase().replace(".", "")).normalize({plurals:true, parentheses:true, possessives:true, honorifics:true, acronyms:true, contractions: true, punctuation: true, case: true, whitespace: true, verbs: true, unicode: true})
          let topicKey = normalized.out()
          let nouns = normalized.nouns().toSingular().json()
          nouns.forEach(noun => {
            if (masterTopics[noun.text]) {
              masterTopics[noun.text]++

            } else {
              masterTopics[noun.text] = 1
            }
          })


          //    console.log(topicKey, "topic key")
        }

      })
    }
  } else {
    analyics.notEnglish ++
    if (analyics.languages[language]) {
      analyics.languages[language] ++
    } else {
      analyics.languages[language] = 1
    }

  }

  done++
//  console.log("added topics to db")
  bar.tick();
//  console.log(Math.round((done / docs.length) * 100) + "%", Object.keys(masterTopics).length, "topic length", done + "/" + "/" + docs.length)

}, err=> {
  console.log("done?")
  console.log(err)
  console.log(masterTopics)
})
console.log("done?")

console.log(masterTopics, analyics, ((analyics.maxWords/docs.length) * 100))
let topics = []
Object.keys(masterTopics).forEach(topic => {
  topics.push({topic: topic, count: masterTopics[topic]})
})
topics = topics.sort((a,b) => {
  return  b.count - a.count
})
console.log(topics)
fs.writeFile("./private/topics.json", JSON.stringify(topics), (err) => {
  console.log("written")
})

/*

const client = new MongoClient(keys.mongoURI, {useNewUrlParser: true});
client.connect(async err => {
  const db = client.db("GraphiteWriter")
  let docs = await db.collection("documents").find().toArray()

    console.log(docs)
    fs.writeFile("./private/documents.json", JSON.stringify(docs), err => {
      console.log("wrote docs")
    })



})*/