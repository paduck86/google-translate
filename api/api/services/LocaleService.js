// LocaleService.js - in api/services
module.exports = {
  setLocale: function(req,res) {

    var acceptLanguage;
    if ( req.headers['accept-language'] ) {
      acceptLanguage = req.headers['accept-language'].split(',')[0].toLowerCase();
    } else {
      acceptLanguage = 'en-us';
    }

    var language = acceptLanguage.split('-')[0];

    switch (acceptLanguage) {
      case "zh-cn":
      case "zh-sg":
      case "zh-tw":
      case "zh-hk":
        req.setLocale(acceptLanguage.split('-')[1]);
        res.setLocale(acceptLanguage.split('-')[1]);
        break;
      default:
        req.setLocale(language);
        res.setLocale(language);
        break;
    }
  },
  getLocale: function(locale) {

    if(locale) {
      switch (locale) {
        case "cn":
        case "sg":
          return "zh-cn";
        case "tw":
        case "hk":
          return "zh-tw";
        default:
          return locale;
      }
    } else {
      return 'en';
    }
  },
  getRegion: function(locale) {
    if(locale) {
      if (locale.split('-')[0] === "zh") {
        return locale.split('-')[1] || "zh";
      } else {
        return locale;
      }
    } else {
      return 'en';
    }
  }
};

