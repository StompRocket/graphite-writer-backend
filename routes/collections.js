var express = require('express');
var router = express.Router();
const keys = require('../private/keys')
const MongoClient = require('mongodb').MongoClient;
const admin = require("firebase-admin")
const moment = require("moment-timezone")
const {v4: uuid} = require("uuid")
const JSONC = require("../jsonc.min.js")
const async = require("async")
let maxDocSize = 3145728
function bytes(s) {
  return ~-encodeURI(s).split(/%..|./).length
}

function jsonSize(s) {
  return bytes(JSON.stringify(s))
}
/*
admin.initializeApp({
  credential: admin.credential.cert(keys.firebase),
  databaseURL: "https://graphite-88e41.firebaseio.com"
});*/
const client = new MongoClient(keys.mongoURI, {useNewUrlParser: true});
client.connect(err => {
  const db = client.db("GraphiteWriter")

  function logLogin(uid) {
    let time = moment().unix()
    admin.auth().getUser(uid)
    .then(async function (userRecord) {
      // See the UserRecord reference doc for the contents of userRecord.
      console.log('Successfully fetched user data:', userRecord.toJSON().displayName, uid);
      let user = userRecord.toJSON()
      let records = await db.collection("users").find({"_id": uid}).toArray()
      let userInfo = {
        email: user.email,
        name: user.displayName,
        "profilePic": user.photoURL,
        "lastSeen": time
      }
      if (records.length > 0) {
        await db.collection("users").updateOne({"_id": uid}, {
          $set: {
            email: user.email, name: user.displayName, profilePic: user.photoURL, lastSeen: time
          }
        })
        console.log("updated user", uid, user.displayName, time)
      } else {
        await db.collection("users").insertOne({
          "_id": uid, email: user.email, name: user.displayName, profilePic: user.photoURL, lastSeen: time, joined: time
        })
        console.log("created user", uid, user.displayName, time)
      }
    })
    .catch(function (error) {
      console.log('Error fetching user data:', error);
    });
  }

  router.post('/:uid/:id', function (req, res, next) {
    if (req.headers.authorization) {
      admin.auth().verifyIdToken(req.headers.authorization)
      .then(async function (decodedToken) {
        let uid = decodedToken.uid;
        console.log(uid)
        logLogin(uid)
        let documents = await db.collection("documents").find({_id: req.params.id}).toArray()
        console.log(documents, "docs")
        let results = documents[0]
        console.log(req.body)
        if (results.owner == uid) {
          let size = jsonSize(req.body)
          console.log("doc Size", size)
          if (size < maxDocSize) {
            if (req.body.tags) {
              await db.collection("documents").updateOne({_id: req.params.id}, {$set: {tags: req.body.tags}})
              console.log("updated tags", req.params.id)

            }

            res.status(200)
            res.send({success: true})
            db.collection("documents").updateOne({_id: req.params.id}, {
              $set: {
                date: req.body.time, opened: req.body.time
              }
            }).then(() => {
              console.log("updated last edited and opened", req.params.id)
            })
          } else {
            res.status(403)
            res.send({error: "too large"})
            res.end()
          }

        } else {
          res.status(400)
          res.send({error: "un authorized"})
          res.end()
        }

      }).catch(function (error) {
        // Handle error
        console.log("admin error", error, req.headers.authorization)
        res.status(400)
        res.send({error: "invalid auth"})
      });
    } else {
      console.log("no auth error")
      res.status(400)
      res.send({error: "no auth"})
    }

  });

  // perform actions on the collection object

});


module.exports = router;
