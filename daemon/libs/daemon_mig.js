var Q = require('q');
var fs = require('fs');
var uuid = require('node-uuid');
var conf = require("./config.js").get();
var googleTranslate = require('google-translate')(conf.apiKey);


Date.prototype.yyyymmddhhmm = function () {
    function pad2(n) {
        return (n < 10 ? '0' : '') + n;
    }
    return this.getFullYear() +
    pad2(this.getMonth() + 1) +
    pad2(this.getDate()) +
    pad2(this.getHours()) +
    pad2(this.getMinutes());
};
var time = new Date().yyyymmddhhmm();
console.log = function (str) {
    str = str + '\n';
    fs.appendFileSync('mig_' + time + '.log', str);
    process.stdout.write(str);
};


module.exports = {
    startTranslate: startTranslate
};


function startTranslate(conn) {

    var start_second, end_second;
    start_second = new Date().getTime() / 1000;

    console.log('=========================================Start!!!=======================================');
    var cntPerProcess = 3;

    Q.fcall(function() {
        return getMigListCnt(conn);
    })
    .then(function (resultCnt) {
        if(!resultCnt) {
            resultCnt = 0;
        }
        return setTranslateLoop(conn, resultCnt, cntPerProcess);
    })
    .catch(function (err) {
        console.log('error ::::: ' + JSON.stringify(err, null, 4));
        process.exit();
    })
    .done(function () {
        console.log('\n\n=========================================Done!!!=======================================');
        end_second = new Date().getTime() / 1000;
        console.log('::::::: SUMMARY ::::::');
        console.log("TOTAL : " + (end_second - start_second));
        process.exit();
    });

}

function getMigListCnt(conn) {
    var deferred = Q.defer();
    var qry = "";
    qry += "select count(*) as cnt";
    qry += "  from ( ";
    qry += "         select videos.uuid as uuid ";
    qry += "              , videos.title as title ";
    qry += "              , videos.description as description ";
    qry += "              , videos_i18n.uuid as uuid_i18n ";
    qry += "           from videos ";
    qry += "           left outer join videos_i18n";
    qry += "             on videos.uuid = videos_i18n.uuid";
    qry += "          group by videos.uuid ";
    qry += "         having uuid_i18n is null ) x";

    conn.query(qry, function(err, result) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(result[0].cnt);
        }
    });

    return deferred.promise;
}

function setTranslateLoop(conn, resultCnt, cntPerProcess) {
    var deferred = Q.defer();
    var total = Math.floor(resultCnt / cntPerProcess);
    var cntArr = [];
    if((resultCnt % cntPerProcess) > 0) {
        total += 1;
    }

    for (var i = 0; i < total; i++) {
        cntArr.push(i+1);
    }
    

    var promises = cntArr.reduce(function(promise, cnt) {
        return promise.then(function() {

            return setTranslate(conn, total, cnt, cntPerProcess);
        });
    }, Q.resolve());

    promises
    .then(function(cnt) {
        if(!cnt) {
            cnt = 0;
        }
        console.log('\n\n[[' + cnt + ' / ' + total + ']]--------------------------[Process done]------------------------------');
        deferred.resolve();
    })
    .catch(function(err) {
        console.log('[[Fail]]--------------------------[Process fail]------------------------------');
        console.log(err);
        deferred.reject(err);
    });

    return deferred.promise;
}

function setTranslate(conn, total, cnt, cntPerProcess) {
    var deferred = Q.defer();

    var start_second, end_second;
    var start_second1, end_second1;
    var start_second2, end_second2;
    var start_second3, end_second3;
    var start_second4, end_second4;
    var start_second5, end_second5;
    var start_second6, end_second6;

    var results = {};
    var data = {};

    start_second = new Date().getTime() / 1000;
    start_second1 = new Date().getTime() / 1000;

    console.log('\n\n[[' + cnt + ' / ' + total + ']]--------------------------[Start translation - parallel]------------------------------');

    Q.fcall(function() {
        /* 0. get migration list */
        return getMigList(conn, data, cntPerProcess);
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
        end_second5 = new Date().getTime() / 1000;
        start_second6 = new Date().getTime() / 1000;

        return reTranslate(conn, results);
    })
    .then(function() {
        //console.log('result ::::: ' + JSON.stringify(results, null, 4));

        end_second6 = new Date().getTime() / 1000;
        end_second = new Date().getTime() / 1000;

        /* 6. done */
        console.log('\n::::::: SUMMARY ::::::');
        console.log("total : " + (end_second - start_second));
        console.log("1.insertVideos : " + (end_second1 - start_second1));
        console.log("2.getLocaleList : " + (end_second2 - start_second2));
        console.log("3.detectLanguage : " + (end_second3 - start_second3));
        console.log("4.translateLanguage : " + (end_second4 - start_second4));
        console.log("5.insertVideosLocale : " + (end_second5 - start_second5));
    })
    .catch(function (err) {

        deferred.reject(err);
    })
    .done(function () {
        deferred.resolve(cnt);
    });

    return deferred.promise;
}

function getMigList(conn, data, cntPerProcess) {
    var deferred = Q.defer();
    var qry = "";
    qry += "select x.uuid ";
    qry += "     , x.title ";
    qry += "     , x.description ";
    qry += "  from ( ";
    qry += "         select videos.uuid as uuid ";
    qry += "              , videos.title as title ";
    qry += "              , videos.description as description ";
    qry += "              , videos_i18n.uuid as uuid_i18n ";
    qry += "           from videos ";
    qry += "           left outer join videos_i18n";
    qry += "             on videos.uuid = videos_i18n.uuid";
    qry += "          group by videos.uuid ";
    qry += "         having uuid_i18n is null ) x limit 0,?";

    conn.query(qry, [cntPerProcess] ,function(err, results) {
        if (err) {
            deferred.reject(err);
        } else {
            data.videos = {};
            for (var i = 0, length = results.length; i < length; i++) {
                var video = results[i];
                data.videos[video.uuid] = video;
            }

            data.videos_length = results.length;

            deferred.resolve();
        }
    });

    return deferred.promise;
}

function getLocaleList(conn, data) {
    var deferred = Q.defer();
    //var qry = "select locale, google_support, alternative from videos_locale where locale <> 'ma'";

    var qry = "select locale, google_support, alternative from videos_locale where locale <> 'ma'";

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
    var videos = data.videos;

    data.detec_success_cnt = 0;

    var promises = [];
    for (var video in videos) {
        var promise = doDetect(data.videos[video], data);
        promises.push(promise);
    }

    Q.all(promises)
        .then(function() {
            console.log('language detection done...');
            console.log('total : ' + data.videos_length + " | success : " + data.detec_success_cnt);
            deferred.resolve();
        })
        .catch(function(err) {
            console.log('language detection fail...' + err);
            console.log('total : ' + data.videos_length + " | success : " + data.detec_success_cnt);
            deferred.resolve(err);
        });

    return deferred.promise;
}

function doDetect(video, data) {
    var deferred = Q.defer();

    googleTranslate.detectLanguage([video.title, video.description], function(err, detections) {
        if(err) {
            video.detectLanguage = video.locale;
            deferred.reject(err);
        } else {
            if (detections[1].language !== 'und') {
                video.detectLanguage = detections[1].language;
            } else if (detections[0].language !== 'und') {
                video.detectLanguage = detections[0].language;
            } else {
                video.detectLanguage = 'en';
            }

            data.detec_success_cnt += 1;
            deferred.resolve();
        }
    });

    return deferred.promise;
}

function translateLanguage(data, results) {
    var deferred = Q.defer();

    var videos = data.videos;
    var locales = data.locales;
    results.failList = {};
    results.failList.videos = [];
    data.trans_success_cnt = 0;

    var promises = Object.keys(videos).reduce(function(promise, uuid) {
        return promise.then(function() {
            return doTranslateLoop(data.videos[uuid], locales, results, data);
        });
    }, Q.resolve());

    promises
    .then(function() {
        console.log('\nlanguage translate done...');
        console.log('total : ' + data.videos_length + " | success : " + data.trans_success_cnt);
        deferred.resolve();
    })
    .catch(function(err) {
        console.log('\nlanguage translate fail...' + err);
        console.log('total : ' + data.videos_length + " | success : " + data.trans_success_cnt);
        deferred.resolve(err);
    });

    return deferred.promise;
}

function doTranslateLoop(video, locales, results, data, parallel_yn) {
    var deferred = Q.defer();

    var locales_length = Object.keys(locales).length;

    if (!parallel_yn) {
        // parallel
        var promises = [];
        for (var locale in locales) {
            // exclude google_not_supported language && the language requesting
            if (video.detectLanguage !== locales[locale].locale && locales[locale].google_support === 'y') {
                results[video.uuid] = {
                    locale_success_cnt : 0,
                    translate_error : ''
                };

                var promise = doTranslate(video, results, locales[locale].locale, locales[locale]);
                promises.push(promise);
            }
        }

        Q.allSettled(promises)
        .then(function(result) {

            data.trans_success_cnt += 1;
            console.log('\n[video translation detail - parallel]');
            console.log('1. video_uuid ::: ' + video.uuid + ' ::: translate done...');
            console.log('2. trans_success_count ::: ' + data.trans_success_cnt + ' / ' + data.videos_length + ' ,,, ' + (data.trans_success_cnt / data.videos_length * 100).toFixed(2) + '%');
            console.log('3. locale_success_count ::: ' + ( results[video.uuid].locale_success_cnt + 4 ) + '/' + locales_length);
            if(results[video.uuid].locale_success_cnt + 4 !== locales_length) {
                console.log('4. err_locale ::: ' + results[video.uuid].translate_error.substring(0, results[video.uuid].translate_error.length - 1));
            }
            deferred.resolve();
        });
    } else {

        // non-parallel
        var promises = Object.keys(locales).reduce(function(promise, locale) {
            return promise.then(function() {
                if (video.detectLanguage !== locale && locales[locale].google_support === 'y') {
                    results[video.uuid] = {
                        locale_success_cnt : 0,
                        translate_error : ''
                    };
                    return doTranslate(video, results, locale);
                }
            });
        }, Q.resolve());

        promises
        .then(function() {
            data.trans_success_cnt += 1;
            console.log('\n[video translation detail - nonparallel]');
            console.log('1. video_uuid ::: ' + video.uuid + ' ::: translate done...');
            console.log('2. trans_success_count ::: ' + data.trans_success_cnt + ' / ' + data.videos_length + ' ,,, ' + (data.trans_success_cnt / data.videos_length * 100).toFixed(2) + '%');
            console.log('3. locale_success_count ::: ' + results[video.uuid].locale_success_cnt + '/' + locales_length);
            if(results[video.uuid].locale_success_cnt !== locales_length) {
                console.log('4. err_locale ::: ' + results[video.uuid].translate_error.substring(0, results[video.uuid].translate_error.length - 1));
            }
            deferred.resolve();
        });
    }

    return deferred.promise;
}

function doTranslate(data, results, locale, locale_obj) {
    var deferred = Q.defer();

    googleTranslate.translate([data.title, data.description], data.detectLanguage, locale, function(err, translations) {

        if(err) {
            results[data.uuid][locale] = {
                success: false,
                locale: locale
            };
            results[data.uuid].translate_error += locale + ',';

            if(!results.failList[data.uuid]) {
                results.failList[data.uuid] = {};
                results.failList[data.uuid] = {
                    uuid : data.uuid,
                    title : data.title,
                    description : data.description,
                    detectLanguage : data.detectLanguage,
                    locales : {}
                };
            }

            results.failList[data.uuid].locales[locale] = locale_obj;

            results.failList.videos.push(data.uuid);
            //console.log('translate error :: ' + locale + ' , ' + err);
            deferred.resolve();
        } else {

            results[data.uuid][locale] = {
                success: true,
                locale: locale,
                title: translations[0].translatedText,
                description: translations[1].translatedText,
            };
            results[data.uuid].locale_success_cnt += 1;

            deferred.resolve();
        }
    });

    return deferred.promise;
}

function insertVideosLocale(conn, results, data) {
    var deferred = Q.defer();
    var videos = data.videos;
    var locales = data.locales;

    var promises = Object.keys(videos).reduce(function(promise, uuid) {
        return promise.then(function() {
            return doInsertVideosLocale(conn, results[uuid], videos[uuid], locales);
        });
    }, Q.resolve());

    promises
    .then(function() {
        console.log('\ninsert videos_locale done...');
        deferred.resolve();
    })
    .catch(function(err) {
        console.log('\ninsert videos_locale fail... ' + err);
        deferred.resolve(err);
    });

    return deferred.promise;
}


function doInsertVideosLocale(conn, result, data, locales) {
    var deferred = Q.defer();

    var qry = "insert into videos_i18n (uuid, locale, title, description) values ";
    var uuid = data.uuid;
    var params = [];

    // add excluded locale (data.detectLanguage, zh, mm, nb)
    var addLocale = [data.detectLanguage, 'zh', 'mm', 'nb'];

    for (var i = 0, length = addLocale.length; i < length; i++) {
        if(result[addLocale[i]] === undefined) {
            switch (addLocale[i]) {
                case data.detectLanguage:
                    result[addLocale[i]] = {
                        success: true,
                        locale: addLocale[i],
                        title: data.title,
                        description: data.description
                    };
                    break;
                default:
                    if(locales[addLocale[i]] !== undefined && locales[addLocale[i]].alternative) {
                        var alternativeLocale = locales[addLocale[i]].alternative;
                        result[addLocale[i]] = {
                            success: true,
                            locale: addLocale[i],
                            title: result[alternativeLocale].title,
                            description: result[alternativeLocale].description
                        };
                    }
                    break;
            }
        }
    }

    for (var property in result) {
        var i18n = result[property];
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

function reTranslate(conn, results_pre) {
    var deferred = Q.defer();
    var results = {};
    var data = {};

    var failList = results_pre.failList;

    if(failList.videos && failList.videos.length === 0) {
        delete failList.videos;
    }

    if(Object.keys(failList).length > 0) {

        console.log('\n\n--------------------------[Repeat translation - nonparallel]------------------------------');
        Q.fcall(function () {
            /* 1. language translate */
            return reTranslateLanguage(failList, results);
        })
        .then(function () {
            /* 2. insert videos_locale */
            return reInsertVideosLocale(conn, results, failList);
        })
        .then(function () {
            deferred.resolve();
        })
        .catch(function (err) {
            deferred.reject(err);
        });
    } else {
        deferred.resolve();
    }
    return deferred.promise;
}

function reTranslateLanguage(data, results) {
    var deferred = Q.defer();
    data.videos_length = data.videos.length;
    data.trans_success_cnt = 0;
    results.failList = {};
    results.failList.videos = [];

    var promises = data.videos.reduce(function(promise, uuid) {
        return promise.then(function() {
            return doTranslateLoop(data[uuid], data[uuid].locales, results, data, true);
        });
    }, Q.resolve());

    promises
    .then(function() {
        console.log('language translate done...');
        console.log('total : ' + data.videos_length + " | success : " + data.trans_success_cnt);
        deferred.resolve();
    })
    .catch(function(err) {
        console.log('language translate fail...' + err);
        console.log('total : ' + data.videos_length + " | success : " + data.trans_success_cnt);
        deferred.resolve(err);
    });

    return deferred.promise;
}

function reInsertVideosLocale(conn, results, data) {
    var deferred = Q.defer();
    var copyResults = results;
    delete copyResults.failList;
    var promises = Object.keys(copyResults).reduce(function(promise, uuid) {
        return promise.then(function() {
            return doReInsertVideosLocale(conn, copyResults[uuid], data[uuid].locales, uuid);
        });
    }, Q.resolve());

    promises
    .then(function() {
        console.log('insert videos_locale done...');
        deferred.resolve();
    })
    .catch(function(err) {
        console.log('insert videos_locale fail... ' + err);
        deferred.resolve(err);
    });

    return deferred.promise;
}

function doReInsertVideosLocale(conn, result, locales, uuid) {
    var deferred = Q.defer();
    var qry = "insert into videos_i18n (uuid, locale, title, description) values ";
    var params = [];
    var isValid;
    //var locales = result[uuid].locales;

    if (Object.keys(locales).length > 0) {
        for (var locale in locales) {
            var i18n = result[locale];

            /*
             results[data.uuid][locale] = {
             success: true,
             locale: locale,
             title: translations[0].translatedText,
             description: translations[1].translatedText,
             };
             results[data.uuid].locale_success_cnt += 1;
             */

            if (i18n && i18n.success === true && i18n.title && i18n.description) {
                isValid = true;
                qry += "(?, ?, ?, ?),";
                params.push(uuid, i18n.locale, i18n.title, i18n.description);
            }
        }

        if (isValid) {
            qry = qry.substring(0, qry.length - 1);

            conn.query(qry, params, function (err, result) {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve();
                }
            });
        } else {
            console.log('hmm....');
            deferred.resolve();
        }
    } else {
        deferred.resolve();
    }
    return deferred.promise;
}