var Q = require('q');
var uuid = require('node-uuid');
var conf = require("./config.js").get();
var googleTranslate = require('google-translate')(conf.apiKey);

module.exports = {
    setTranslate: setTranslate
};


function setTranslate(conn, data) {
    var start_second, end_second;
    var start_second1, end_second1;
    var start_second2, end_second2;
    var start_second3, end_second3;
    var start_second4, end_second4;
    var start_second5, end_second5;

    var results = {};

    start_second = new Date().getTime() / 1000;
    start_second1 = new Date().getTime() / 1000;

    Q.fcall(function() {
        /* 0. insert videos */
        return insertVideos(conn, data);
    })
    .then(function() {
        end_second1 = new Date().getTime() / 1000;
        start_second2 = new Date().getTime() / 1000;

        /* 1. get locale list */
        return getLocaleList(conn, data);
    })
    .then(function() {
        end_second2 = new Date().getTime() / 1000;
        start_second3 = new Date().getTime() / 1000;

        /* 2. language detecting */
        return detectLanguage(data);
    })
    .then(function() {
        end_second3 = new Date().getTime() / 1000;
        start_second4 = new Date().getTime() / 1000;

        /* 3. language translate */
        /*
         The V2 API only allows one target language per request.
         The maximum size of each text to be translated is 5000 characters.
         */
        return translateLanguage(data, results);
    })
    .then(function() {
        end_second4 = new Date().getTime() / 1000;
        start_second5 = new Date().getTime() / 1000;

        /* 4. insert videos_locale */
        return insertVideosLocale(conn, results);
    })
    .then(function() {
        end_second5 = new Date().getTime() / 1000;

        /* 5. done */
        console.log('::::::: SUMMARY ::::::');
        console.log("total : " + (end_second - start_second));
        console.log("1.insertVideos : " + (end_second1 - start_second1));
        console.log("2.getLocaleList : " + (end_second2 - start_second2));
        console.log("3.detectLanguage : " + (end_second3 - start_second3));
        console.log("4.translateLanguage : " + (end_second4 - start_second4));
        console.log("5.insertVideosLocale : " + (end_second5 - start_second5));
    })
    .catch(function (err) {
        logErr(err);
    })
    .done();
}

function insertVideos(conn, data) {
    var deferred = Q.defer();
    var qry = "insert into videos (uuid, title, description, locale) values (?, ?, ?, ?)";
    var params = {
        uuid: uuid.v4(),
        title: data.title,
        description: data.description,
        locale: data.locale
    };

    conn.query(qry, params, function(err, results) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve();
        }
    });

    return deferred.promise;
}

function getLocaleList(conn, data) {
    var deferred = Q.defer();
    var qry = "select locale from videos_locale";

    conn.query(qry, function(err, results) {
        if(err) {
            deferred.reject(err);
        } else {
            data.locales = results;
            deferred.resolve();
        }
    });

    return deferred.promise;
}

function detectLanguage(data) {
    var deferred = Q.defer();

    googleTranslate.detectLanguage(data.description, function(err, detection) {
        if(err) {
            data.detectLanguage = data.locale;
            deferred.resolve();
        } else {
            data.detectLanguage = detection;
            deferred.resolve();
        }
    });

    return deferred.promise;
}

function translateLanguage(data, results) {
    var deferred = Q.defer();
    var locales = data.locales;

    // todo : (Q.all) loop  돌리기
    // todo : 자기언어면 pass
    googleTranslate.translate([data.title, data.description], data.detectLanguage, locales[0], function(err, translations) {
        if(err) {
            deferred.reject(err);
        } else {
            results[locales[0]] = {
                title: translations[0].translatedText,
                description: translations[1].translatedText,
                locale: locales[0]
            };
            deferred.resolve();
        }
    });
    return deferred.promise;
}

function insertVideosLocale(conn, results) {
    var deferred = Q.defer();

    return deferred.promise;
}

function logErr(err) {
    var output = '';
    for (var property in err) {
        output += property + ': ' + err[property]+'; ';
    }
    console.log("::::: error :::::" + output);
}
