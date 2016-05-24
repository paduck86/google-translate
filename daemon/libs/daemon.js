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
        return insertVideosLocale(conn, results, data);
    })
    .then(function() {
        console.log('result ::::: ' + JSON.stringify(results, null, 4));
                
        end_second5 = new Date().getTime() / 1000;
        end_second = new Date().getTime() / 1000;

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
        console.log('result ::::: ' + JSON.stringify(err, null, 4));
    })
    .done();
}

function insertVideos(conn, data) {
    var deferred = Q.defer();
    var qry = "insert into videos (uuid, title, description, locale) values (?, ?, ?, ?)";
    data.uuid = uuid.v4();
    var params = [
        data.uuid,
        data.title,
        data.description,
        data.locale
    ];

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
    var qry = "select locale, google_support, alternative from videos_locale";

    conn.query(qry, function(err, results) {
        if(err) {
            deferred.reject(err);
        } else {
            data.locales = {};
            for (var i = 0, length = results.length; i < length; i++) {
                data.locales[results[i].locale] = {
                    locale: results[i].locale,
                    google_support: results[i].google_support,
                    alternative: results[i].alternative
                };
            }

            deferred.resolve();
        }
    });

    return deferred.promise;
}

function detectLanguage(data) {
    var deferred = Q.defer();

    googleTranslate.detectLanguage([data.title, data.description], function(err, detections) {
        if(err) {
            data.detectLanguage = data.locale;
            deferred.reject(err);
        } else {
            if (detections[1].language !== 'und') {
                data.detectLanguage = detections[1].language;
            } else if (detections[0].language !== 'und') {
                data.detectLanguage = detections[0].language;
            } else {
                data.detectLanguage = 'en';
            }

            deferred.resolve();
        }
    });

    return deferred.promise;
}

function translateLanguage(data, results) {
    var deferred = Q.defer();
    var locales = data.locales;

    var promises = [];
    for (var locale in locales) {
        // exclude google_not_supported language && the language requesting
        if (data.detectLanguage !== locales[locale].locale && locales[locale].google_support === 'y') {
            var promise = doTranslate(data, results, locales[locale].locale);
            promises.push(promise);
        }
    }

    Q.allSettled(promises)
        .then(function() {
            console.log('translate done...');
            deferred.resolve();
        });

    return deferred.promise;
}

function doTranslate(data, results, locale) {
    var deferred = Q.defer();

    googleTranslate.translate([data.title, data.description], data.detectLanguage, locale, function(err, translations) {
        if(err) {
            results[locale] = {
                success: false,
                locale: locale
            };
            deferred.reject(err);
        } else {
            results[locale] = {
                success: true,
                locale: locale,
                title: translations[0].translatedText,
                description: translations[1].translatedText
            };
            deferred.resolve();
        }
    });

    return deferred.promise;
}

function insertVideosLocale(conn, results, data) {
    var deferred = Q.defer();
    var qry = "insert into videos_i18n (uuid, locale, title, description) values ";
    var uuid = data.uuid;
    var params = [];

    // add excluded locale (data.detectLanguage, zh, mm, nb)
    var addLocale = [data.detectLanguage, 'zh', 'mm', 'nb'];
    for (var i = 0, length = addLocale.length; i < length; i++) {
        if(results[addLocale[i]] === undefined) {
            switch (addLocale[i]) {
                case data.detectLanguage:
                    results[addLocale[i]] = {
                        success: true,
                        locale: addLocale[i],
                        title: data.title,
                        description: data.description
                    };
                    break;
                default:
                    //todo : null 체크 유틸 만들기~~~
                    if(data.locales[addLocale[i]] !== undefined && data.locales[addLocale[i]].alternative) {
                        var alternativeLocale = data.locales[addLocale[i]].alternative;
                        results[addLocale[i]] = {
                            success: true,
                            locale: addLocale[i],
                            title: results[alternativeLocale].title,
                            description: results[alternativeLocale].description
                        };
                    }
                    break;
            }
        }
    }

    for (var property in results) {
        var i18n = results[property];
        if(i18n && i18n.success === true && i18n.title && i18n.description) {
            qry += "(?, ?, ?, ?),";
            params.push(uuid, i18n.locale, i18n.title, i18n.description);
        }
    }

    qry = qry.substring(0, qry.length-1);


    
    conn.query(qry, params, function(err, result) {
        if(err) {
            deferred.reject(err);
        } else {
            deferred.resolve();
        }
    });
    return deferred.promise;
}


