console.log("intalized migration engine")
const admin = require("firebase-admin")
const keys = require('./private/keys')
const MongoClient = require('mongodb').MongoClient;
const serviceAccount = keys.firebase
const sjcl = require("./sjcl")
const moment = require("moment-timezone")
const fs = require("fs")
let users = require("./private/users.json")
console.log("users loaded", Object.keys(users).length)
const fetch = false
const fetchShared = false
const getUSERS = true
let sharedDocs = require("./private/shared.json")
var async = require("async");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://graphite-88e41.firebaseio.com"
});
const fb = admin.database();
const client = new MongoClient(keys.mongoURI, {useNewUrlParser: true, useUnifiedTopology: true});
let stats = {
  docs: 0,
  enc: 0,
  version: {
    0: 0,
    1:0,
    2:0,
    3: 0
  },
  incomplete: 0,
  incompleteLogs: [],
  shared: 0
}
client.connect(err => {
  console.log("mongo connect error", err)
  const db = client.db("GraphiteWriter")
  if (fetch) {
    console.log("fetch")
    fb.ref("/users").once("value", (snap) => {
      users = snap.val()
      console.log("got users")
      fs.writeFile("./private/users.json", JSON.stringify(users), (error) => {
        console.log("written", error)
      })
    })
  }
  if (!fetch && getUSERS) {
    console.log("no fetch")
    async.each(Object.keys(users), function (uid, callback) {
      if (users.hasOwnProperty(uid)) {

        let user = users[uid]
        let docs = users[uid].docs
        let docsStorage = users[uid].docsStorage
        if (docs) {
          console.log(Object.keys(docs).length, "doc count")
          Object.keys(docs).forEach((docID) => {
            if (docs.hasOwnProperty(docID)) {
              let doc = docs[docID]
              if (doc.title) {
                let title = doc.title
                let enc = doc.enc
                let version = doc.version
                let date = moment(doc.date).unix()
                console.log(date)
                let data = {}
                if (!version) {
                  if (enc) {
                    data = sjcl.decrypt(uid, doc.data)
                  } else {
                    data = doc.data
                  }
                  version = 0
                } else if (version == 2) {
                  if (enc) {
                    data = sjcl.decrypt(uid, docsStorage[docID].data)
                  } else {
                    data = docsStorage[docID].data
                  }
                } else if (version == 1) {
                  if (enc) {
                    data = sjcl.decrypt(uid, doc.data)
                  } else {
                    data = doc.data
                  }
                }

                let dataComplete = true
                if (title === null || title === undefined) {
                  title = ""
                  stats.incomplete ++
                  stats.incompleteLogs.push({id: docID, uid: uid, title})
                }
                if (version >=0) {

                } else {
                  version = 0
                  stats.incomplete ++
                  stats.incompleteLogs.push({id: docID, uid: uid, version})
                }
                if (data === undefined || data === false || data === null) {
                  stats.incomplete ++
                  stats.incompleteLogs.push({id: docID, uid: uid, data})
                  data = ""
                }
                stats.docs ++
                stats.version[version] ++
                if (enc) {
                  stats.enc ++
                }
                console.log(title, data, version, docID, uid)
                db.collection("documents").updateOne({_id: docID},{$set:{date: date, title: title, opened: date, data: data,owner:uid}}).then(() => {
                  console.log("updated:", docID, date)
                })
                console.log(stats)
              }
            } else {
              console.log("fake doc", docID)
            }

          })
        }

        /*
        db.collection("users").find({_id: uid}).toArray((err, usersInDB) => {
         // console.log(err, uid, usersInDB, "db search")
          if (usersInDB.length == 0) {
            db.collection("users").insertOne({
              _id: uid, name: user.userinfo.username, profilePic: user.userinfo["profile_picture"],
              lastSeen: user.userinfo["last_seen"], email: user.userinfo.email
            }).then(callback)
            console.log("added " + uid);
          } else {
            console.log("allready in DB " + uid);
            callback()
          }
        })
*/

      }
    })
  }
  if (fetchShared) {
    fb.ref('/shared').once('value',(snap) => {
       sharedDocs = snap.val()
      fs.writeFile("./private/shared.json", JSON.stringify(sharedDocs), (error) => {
        console.log("written", error)
      })
    })
  } else if(false) {
    async.each(Object.keys(sharedDocs), function (uid, callback) {
      let docs = users[uid].docs
      if (docs) {
        Object.keys(docs).forEach((docID) => {
          if (docs.hasOwnProperty(docID)) {
            let doc = docs[docID]
            if (doc.title) {
              let title = doc.title
              let data = doc.data
              let date = doc.date

              stats.shared++
              db.collection("documents").updateOne({_id: docID}, {$set: {shared: true}}).then((err) => {
                console.log("updated", docID)
              })
            }
          }
        })
      }
    })
  }

});