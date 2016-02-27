'use strict';

const Promise = require('bluebird');
const argv = require('yargs').argv;
const nano = require('nano');
const analyze = require('../analysis/analyze');
const queue = require('../analysis/queue');
const statQueue = require('./util/statQueue');
const statTokens = require('./util/statTokens');
const statProgress = require('./util/statProgress');

function onMessage(msg) {
    return analyze(msg.data, npmNano, npmsNano, {
        githubTokens,
        waitRateLimit: true,
    })
    .catch((err) => {
        // Ignore unrecoverable errors, so that these are not re-queued
        if (!err.unrecoverable) {
            throw err;
        }
    });
}

// ----------------------------------------------------------------------------

// Split out tokens into an array
const githubTokens = process.env.GITHUB_TOKENS && process.env.GITHUB_TOKENS.split(/\s*,\s*/);

// Prepare DB stuff
const npmNano = Promise.promisifyAll(nano(process.env.COUCHDB_NPM_ADDR, { requestDefaults: { timeout: 15000 } }));
const npmsNano = Promise.promisifyAll(nano(process.env.COUCHDB_NPMS_ADDR, { requestDefaults: { timeout: 15000 } }));

// Setup analyzer queue
const analyzeQueue = queue(process.env.RABBITMQ_QUEUE, process.env.RABBITMQ_ADDR)
.once('error', () => process.exit(1));

// Print stats
statQueue(analyzeQueue);             // Print queue stat once in a while
statTokens(githubTokens, 'github');  // Print token usage once in a while
statProgress(npmNano, npmsNano);     // Print global analysis progress

// Start consuming
analyzeQueue.consume(onMessage, { concurrency: argv.concurrency })
.catch(() => process.exit(1));

// TODO: cleanup temporary folder
// TODO: not analyze if pushedAt < finishedAt of analysis