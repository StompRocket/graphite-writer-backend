var express = require('express');
var router = express.Router();
const keys = require('../private/keys')
const MongoClient = require('mongodb').MongoClient;
const admin = require("firebase-admin")
const moment = require("moment-timezone")
const {v4: uuid} = require("uuid")
const JSONC = require("../jsonc.min.js")
const nlp = require("compromise")
let whitelist = ["DeKQnb9uQSOchpr5qD3oDkIBYnv1", "dphPDWHJfDakVZVIO75w0Bc1e9m1"]
/*
admin.initializeApp({
  credential: admin.credential.cert(keys.firebase),
  databaseURL: "https://graphite-88e41.firebaseio.com"
});*/
function convertDeltaToText(delta)  {
  let string = ""

  delta.ops.forEach(ops => {

    if (typeof ops.insert == "string") {
      string += ops.insert
    }

  })

  return string
}
const client = new MongoClient(keys.mongoURI, {useNewUrlParser: true});
client.connect(err => {
  const db = client.db("GraphiteWriter")
  router.get('/users', async function (req, res, next) {
    if (req.headers.authorization) {
      console.log("authorization exists")
      admin.auth().verifyIdToken(req.headers.authorization)
      .then(async function (decodedToken) {
        let uid = decodedToken.uid;
        if (whitelist.indexOf(uid) > -1) {

          let users = await db.collection("users").find().toArray()

          res.status(200)
          res.send(users)
          res.end()
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
  router.get('/documents/:uid', async function (req, res, next) {
    if (req.headers.authorization) {
      console.log("authorization exists")
      admin.auth().verifyIdToken(req.headers.authorization)
      .then(async function (decodedToken) {
        let uid = decodedToken.uid;
        if (whitelist.indexOf(uid) > -1) {

          let documents = await db.collection("documents").find({owner: req.params.uid}, {"_id": 1, title: 1, owner: 1, shared: 1, date: 1, opened: 1}).toArray()

          res.status(200)
          res.send(documents)
          res.end()
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

  router.get('/documents/:uid/:id', async function (req, res, next) {
    if (req.headers.authorization) {
      console.log("authorization exists")
      admin.auth().verifyIdToken(req.headers.authorization)
      .then(async function (decodedToken) {
        let uid = decodedToken.uid;
        if (whitelist.indexOf(uid) > -1) {

          let documents = await db.collection("documents").find({"_id": req.params.id}).toArray()

          res.status(200)
          res.send(documents[0])
        //  console.log(documents[0].data)
         let string =  convertDeltaToText(JSON.parse(documents[0].data))
          let doc = nlp(string)
          console.log("topcs", doc.topics().unique().json())
          console.log("topcs", nlp(documents[0].title).topics().unique().json())
          res.end()
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

  // perform actions on the collection object

});


module.exports = router;
