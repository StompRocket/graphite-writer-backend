const { initializeApp, cert } = require("firebase-admin/app")
const { getAuth } = require("firebase-admin/auth")
const keys = require('./private/keys')

const app = initializeApp({
  credential: cert(keys.firebase),
  databaseURL: "https://graphite-88e41.firebaseio.com"
});

// keeps the old namespaced admin.auth() call style used by the routes
module.exports = {
  auth: () => getAuth(app)
}
