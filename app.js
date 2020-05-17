var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var compression = require('compression')
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var documentsRouter = require('./routes/documents');
var collectionsRouter = require('./routes/collections');
var adminRouter = require('./routes/admin.js');
const cors = require('cors')
var app = express();
app.use(cors())
app.use(logger('dev'));
app.use(express.json({limit: '50mb'}))
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(compression({ filter: shouldCompress, level: 4 }))

function shouldCompress (req, res) {
  if (req.headers['x-no-compression']) {
    // don't compress responses with this request header
    return false
  }
  console.log("compressing")

  // fallback to standard filter function
  return compression.filter(req, res)
}
app.use('/', indexRouter);
//app.use('/users', usersRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/collections', collectionsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/user/', usersRouter);

/*
// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
*/
module.exports = app;
