var lib_env = require("../../libs/env.js"),
    env = lib_env.get();

module.exports = {
    db: {
        name: "mysql",
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PWD,
        database: env.DB_NAME
    },

    redis: {
        host: "127.0.0.1",
        port: 6379
    },

    apiKey: env.GOOGLE_API_KEY
};