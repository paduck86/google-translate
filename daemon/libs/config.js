module.exports = {
    get : function () {
        var argv = process.argv,
            arr_val,
            conf = {};

        argv.slice(2, argv.length).forEach(function(data) {
            arr_data = data.split("=");
            name = arr_data[0];
            value = arr_data[1];
            if(name === "env") {
                conf = require("../config/env/" + value + ".js");
                conf.env = value;
            }
        });

        if(typeof conf.db.host === "undefined") {
            console.log("Error!!!");
            console.log("Usage : " + argv[0] + " " + argv[1] + " env=[development|staging|production]");
            process.exit(1);
        }

        return conf;
    }
};