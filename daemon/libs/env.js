module.exports = {
    get: function () {
        var dotenv = require('dotenv'),
            fs = require('fs'),
            node_env = (typeof process.env.NODE_ENV === "undefined") ? "development" : process.env.NODE_ENV,
            file = fs.readFileSync(__dirname + "/../config/env/" + node_env + ".env"),
            env = dotenv.parse(file);

        return env;
    }
};