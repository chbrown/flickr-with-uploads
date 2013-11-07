'use strict'; /*jslint es5: true, node: true, indent: 2 */

/** Logger

A little shim that resembles winston but allows us to avoid that additional dependency.
Also I don't really like winston anymore.

But if you wanted, you could hook winston in with the following:

    var winston = require('winston');
    var root = require('flickr-with-uploads/lib/logger');
    root.handler = new winston.Logger();

*/

var Logger = function(handler) {
  if (handler === undefined) handler = console;

  this.handler = handler;
};
Logger.prototype.log = function(level, args) {
  // default to the universal "log" if there is no property by the loglevel name
  if (!(level in this.handler)) level = 'log';

  this.handler[level].apply(this.handler, args);
};

var levels = ['critical', 'error', 'warn', 'info', 'debug'];
levels.forEach(function(level) {
  Logger.prototype[level] = function(/* arguments */) {
    this.log(level, arguments);
  };
});

module.exports = new Logger();
