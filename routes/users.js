var express = require('express');
var router = express.Router();
var express = require('express');
var router = express.Router();
const keys = require('../private/keys')
const MongoClient = require('mongodb').MongoClient;
const admin = require("firebase-admin")
const moment = require("moment-timezone")
const {v4: uuid} = require("uuid")
const JSONC = require("../jsonc.min.js")
const async = require("async")
/* GET users listing. */
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
  router.post('/', function (req, res, next) {
    if (req.headers.authorization) {
      admin.auth().verifyIdToken(req.headers.authorization)
      .then(async function (decodedToken) {
        let uid = decodedToken.uid;
        console.log(uid)
        logLogin(uid)
        if (req.body.locale) {
          console.log("got request to update local")
       await  db.collection("users").updateOne({_id: uid}, {$set: {locale: req.body.locale}})
          console.log(`updated: ${uid} to ${req.body.locale}`)
        }
    res.status(200)
      })
    }})
})

module.exports = router;
