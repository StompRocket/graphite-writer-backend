var express = require('express');
var router = express.Router();
const keys = require('../private/keys')
const MongoClient = require('mongodb').MongoClient;
const admin = require("firebase-admin")
const moment = require("moment-timezone")
const {v4: uuid} = require("uuid")
const JSONC = require("../jsonc.min.js")
const async = require("async")
admin.initializeApp({
  credential: admin.credential.cert(keys.firebase),
  databaseURL: "https://graphite-88e41.firebaseio.com"
});
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

  router.get('/', function (req, res, next) {
    if (req.headers.authorization) {
      admin.auth().verifyIdToken(req.headers.authorization)
      .then(async function (decodedToken) {
        let uid = decodedToken.uid;
        console.log(uid)
        logLogin(uid)
        let documents = await db.collection("documents").find({owner: uid}, {
          projection: {
            title: 1, date: 1, owner: 1, opened: 1, shared: 1
          }
        }).toArray()
        let sharedDocs = await db.collection("sharedDocOpens").findOne({"_id": uid})
        if (sharedDocs) {
          await async.forEach(Object.keys(sharedDocs), async id => {
            if (sharedDocs[id].owner) {
              let doc = await db.collection("documents").findOne({_id: id}, {
                projection: {
                  title: 1, date: 1, owner: 1, opened: 1, shared: 1
                }
              })
              if (doc) {
                console.log("shared doc", doc)

                let ownerInfo = await db.collection("users").findOne({_id: doc.owner})
                doc.ownerInfo = ownerInfo.name
                doc.opened = sharedDocs[id].timeStamp
                documents.push(doc)
              }
            }
          })

          console.log("done with shared docs")

        }
        console.log(documents, "docs")
        let results = documents.map(doc => {
          let opened = doc.opened ? doc.opened : doc.date
          let owner = ""
          let sharedDoc = false
          if (doc.owner == uid) {
            owner = "You"
            console.log(" owner", Object.keys(sharedDocs).length)
          } else {
            console.log("not owner")
            sharedDoc = true
            owner = doc.ownerInfo
          }
          return {
            sharedDoc: sharedDoc,
            index: opened,
            opened: opened,
            title: doc.title,
            date: doc.date,
            owner: owner,
            ownerId: doc.owner,
            id: doc["_id"]
          }
        })
        console.log(results)
        res.status(200)
        res.send(results)
        res.end()
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
  router.get('/:uid/:id', async function (req, res, next) {
    if (req.headers.authorization) {
      console.log("authorization exists")
      admin.auth().verifyIdToken(req.headers.authorization)
      .then(async function (decodedToken) {
        let uid = decodedToken.uid;
        console.log(uid)
        logLogin(uid)
        let documents = await db.collection("documents").find({_id: req.params.id}).toArray()
        console.log(documents, "docs")
        let results = documents[0]

        if (results.owner == uid || results.shared) {
          //  results.data = JSONC.pack(results.data)
          res.status(200)
          res.send(results)

          if (results.owner != uid) {
            console.log("adding shared log")
            db.collection("sharedDocOpens").findOne({"_id": uid}).then(doc => {
              console.log(doc, "shated doc opens")
              if (doc) {
                db.collection("sharedDocOpens").updateOne({"_id": uid}, {
                  $set: {
                    [req.params.id]: {
                      doc: req.params.id, owner: results.owner, timeStamp: moment().unix()
                    }
                  }
                }).then(err => {
                  console.log(err.result.n, "added shared log")

                })
              } else {
                db.collection("sharedDocOpens").insertOne({
                  "_id": uid,
                  [req.params.id]: {
                    doc: req.params.id, owner: results.owner, timeStamp: moment().unix()
                  }
                }).then(err => {
                  console.log(err.result.n, "created shared log")

                })
              }
            })
            /*
        */
          } else {
            db.collection("documents").updateOne({_id: req.params.id}, {$set: {opened: moment().unix()}}).then(() => {
              console.log("updated last opened", req.params.id)
            })
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
      console.log("no authorization")
      let documents = await db.collection("documents").find({_id: req.params.id}).toArray()
      console.log(documents, "docs")
      let results = documents[0]

      if (results.shared) {
        res.status(200)
        res.send(results)

      } else {
        res.status(400)
        res.send({error: "un authorized"})
        res.end()
      }

    }

  });
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
          if (req.body.title) {
            await db.collection("documents").updateOne({_id: req.params.id}, {$set: {title: req.body.title}})
            console.log("updated title", req.params.id)

          }
          if (req.body.data) {
            await db.collection("documents").updateOne({_id: req.params.id}, {$set: {data: req.body.data}})
            console.log("updated title", req.params.id)

          }
          if (req.body.shared) {
            await db.collection("documents").updateOne({_id: req.params.id}, {$set: {shared: req.body.shared}})
            console.log("updated share", req.params.id, req.body.shared)

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
  router.delete('/:uid/:id', function (req, res, next) {
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
          if (req.body.deleteDoc) {
            await db.collection("documents").deleteOne({_id: req.params.id})
            console.log("deleted doc", req.params.id)
            res.status(200)
            res.send({success: true})

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
  router.post('/new', function (req, res, next) {
    if (req.headers.authorization) {
      admin.auth().verifyIdToken(req.headers.authorization)
      .then(async function (decodedToken) {
        let uid = decodedToken.uid;
        logLogin(uid)
        console.log(uid)
        let id = uuid()
        db.collection("documents").insertOne({
          _id: id, title: req.body.title, date: req.body.time, opened: req.body.time, owner: uid, data: ""
        }).then(() => {
          console.log("created", id)
          console.log(req.body)

          res.status(200)
          res.send({success: true, id: id})
        })


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
