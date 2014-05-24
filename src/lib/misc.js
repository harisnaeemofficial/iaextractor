var {Cc, Ci, Cu} = require("chrome"),
    Request      = require("sdk/request").Request,
    prefs        = require("sdk/simple-prefs").prefs;
    
Cu.import("resource://gre/modules/DownloadUtils.jsm");

function format (size) {
  if (!size) return NaN;
  return DownloadUtils.convertByteUnits(size).join(" ");
}
exports.format = format;

/** Low level prefs **/
var _prefs = (function () {
  var pservice = Cc["@mozilla.org/preferences-service;1"].
    getService(Ci.nsIPrefService).
    getBranch("extensions.feca4b87-3be4-43da-a1b1-137c24220968@jetpack.");
  return {
    getIntPref: pservice.getIntPref,
    setIntPref: pservice.setIntPref,
    getCharPref: pservice.getCharPref,
    setCharPref: pservice.setCharPref,
    getBoolPref: pservice.getBoolPref,
    setBoolPref: pservice.setBoolPref,
    getComplexValue: pservice.getComplexValue,
    setComplexValue: function (id, val) {
      var str = Cc["@mozilla.org/supports-string;1"]
        .createInstance(Ci.nsISupportsString);
      str.data = val;
      pservice.setComplexValue(id, Ci.nsISupportsString, str);
    }
  }    
})();
exports.prefs = _prefs;

/** Prompt **/
var prompts = (function () {
  let prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].
    getService(Ci.nsIPromptService);
  return function (title, content, items) {
    var selected = {};
    var result = prompts.select(null, title, content, items.length, items, selected);
    return [result, selected.value];
  }
})();
exports.prompts = prompts;

/** Prompt2 **/
var prompts2 = (function () {
  let prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);

  return function (title, content, strButton0, strButton1, strCheck, checked) {
    var check = {value: checked};
    var flags = prompts.BUTTON_POS_0 * (strButton0 ? prompts.BUTTON_TITLE_IS_STRING : prompts.BUTTON_TITLE_YES) +
                prompts.BUTTON_POS_1 * (strButton1 ? prompts.BUTTON_TITLE_IS_STRING : prompts.BUTTON_TITLE_NO);
    var button = prompts.confirmEx(null, title, content, flags, strButton0 || "", strButton1 || "", "", strCheck, check);
    return {
      button: button,
      check: check
    }
  }
})();
exports.prompts2 = prompts2;

/** Calculate file size **/
var cache = {};
var calculate = function (url, callback, pointer) {
  if (cache[url]) {
    callback.apply(pointer, [url, format(cache[url])]);
    return;
  }
  var sent = false;
  var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
    .createInstance(Ci.nsIXMLHttpRequest);
  req.open('GET', url, true);
  req.setRequestHeader('Cache-Control', 'no-cache');
  req.channel.loadFlags |= Ci.nsIRequest.LOAD_BYPASS_CACHE;  
  req.onreadystatechange = function (aEvt) {
    if (sent) return;
    if (req.readyState == 3) {
      var size = req.getResponseHeader("Content-Length");
      if (req.status == 200) {
        if (size) {
          cache[url] = size;
          callback.apply(pointer, [url, format(size)]);
          sent = true;
          req.abort();
        }
      }
    }
    if (req.readyState == 4) {
      if (req.status == 200) {
        var size = null;
        try {
          size = req.getResponseHeader("Content-Length");
        }
        catch (e){}
        cache[url] = size;
        callback.apply(pointer, [url, format(size)]);
      }
      else {  // Size is zero
        callback.apply(pointer, [url, null]);
      }
      sent = true;
      req.abort();
    }
  };
  req.send(null);
}
exports.fileSize = calculate;