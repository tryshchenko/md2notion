'use strict';

const PREFIX = 'md2notion';

function info(msg) {
  console.log(`[${PREFIX}] ${msg}`);
}

function error(msg) {
  console.error(`[${PREFIX}] ${msg}`);
}

module.exports = { info, error };
