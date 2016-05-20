module.exports = {
    postVideo: _postVideo
};

var redis = require('redis').createClient(sails.config.redis.port, sails.config.redis.host);

function _postVideo(req, res) {
    var params = req.params.all(),
        title = params.title,
        description = params.description,
        locale = req.getLocale();

    var video = {
        title: title,
        description: description,
        locale: locale
    };

    redis.lpush('ch_translate', JSON.stringify(video));

    return res.json(video);
}

