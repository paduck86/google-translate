var conf = require("./libs/config.js").get(),
    mysql = require(conf.db.name),
    daemon_mig = require("./libs/daemon_mig.js"),
    conn = mysql.createConnection({
        connectionLimit: 10,
        host: conf.db.host,
        port: conf.db.port,
        database: conf.db.database,
        user: conf.db.user,
        password: conf.db.password
    });

conn.connect();

daemon_mig.startTranslate(conn);






