var conf = require("./libs/config.js").get(),
    mysql = require(conf.db.name),
    daemon = require("./libs/daemon.js"),
    conn = mysql.createConnection({
        connectionLimit: 10,
        host: conf.db.host,
        port: conf.db.port,
        database: conf.db.database,
        user: conf.db.user,
        password: conf.db.password
    }),
    redis = require('redis').createClient(conf.redis.port, conf.redis.host),
    redisQueue = require('./libs/redis-queue.js'),
    myQueue = new redisQueue(redis);

conn.connect();

//daemon.setTranslate(conn, redis);
console.log('hello~ ::' + conf.redis.port + ',,,' + conf.redis.host);

myQueue.on('message', function(queueName, payload) {
    if (queueName === "ch_translate") {
        var data = JSON.parse(payload);
        console.log(data);

        daemon.setTranslate(conn, data);
    }
});

myQueue.on('error', function(error) {
    console.error(error);
});

myQueue.monitor("ch_translate");

console.log("start redis queue");






