const {Cc, Ci} = require("chrome");
var request = require("request");

/* Parse a soup of HTML from a string. Code adapted from 
 * /mozilla/toolkit/components/places/src/nsMicrosummaryService.js#1696
 */
function loadHTMLText(html, uri, callback) {
    var wM = Cc['@mozilla.org/appshell/window-mediator;1'].
             getService(Ci.nsIWindowMediator);
    var window = wM.getMostRecentWindow("navigator:browser");
    
    if (!window)
        return false;
        
    var document = window.document;
    var rootElement = document.documentElement;

    // Create an iframe, make it hidden, and secure it against untrusted content.
    var iframe = document.createElement('iframe');
    iframe.setAttribute("collapsed", true);
    iframe.setAttribute("type", "content");

    // Insert the iframe into the window, creating the doc shell.
    rootElement.appendChild(iframe);

    // When we insert the iframe into the window, it immediately starts loading
    // about:blank, which we don't need and could even hurt us (for example
    // by triggering bugs like bug 344305), so cancel that load.
    var webNav = iframe.docShell.QueryInterface(Ci.nsIWebNavigation);
    webNav.stop(Ci.nsIWebNavigation.STOP_NETWORK);

    // Turn off JavaScript and auth dialogs for security and other things
    // to reduce network load.
    // XXX We should also turn off CSS.
    iframe.docShell.allowJavascript = false;
    iframe.docShell.allowAuth = false;
    iframe.docShell.allowPlugins = false;
    iframe.docShell.allowMetaRedirects = false;
    iframe.docShell.allowSubframes = false;
    iframe.docShell.allowImages = false;
    iframe.docShell.allowDNSPrefetch = false;
    
    // Convert the HTML text into an input stream.
    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                    createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    var stream = converter.convertToInputStream(html);

    // Set up a channel to load the input stream.
    var channel = Cc["@mozilla.org/network/input-stream-channel;1"].
                  createInstance(Ci.nsIInputStreamChannel);
    channel.setURI(uri);
    channel.contentStream = stream;

    // Load in the background so we don't trigger web progress listeners.
    var request = channel.QueryInterface(Ci.nsIRequest);
    request.loadFlags |= Ci.nsIRequest.LOAD_BACKGROUND;

    // Specify the content type since we're not loading content from a server,
    // so it won't get specified for us, and if we don't specify it ourselves,
    // then Firefox will prompt the user to download content of "unknown type".
    var baseChannel = channel.QueryInterface(Ci.nsIChannel);
    baseChannel.contentType = "text/html";

    // Load as UTF-8, which it'll always be, because XMLHttpRequest converts
    // the text (i.e. XMLHTTPRequest.responseText) from its original charset
    // to UTF-16, then the string input stream component converts it to UTF-8.
    baseChannel.contentCharset = "UTF-8";

    var parseHandler = {
        handleEvent: function _handleEvent(event) {
            event.target.removeEventListener("DOMContentLoaded", this, false);
            callback(iframe.contentDocument);
        }
    };
    
    // Register the parse handler as a load event listener and start the load.
    // Listen for "DOMContentLoaded" instead of "load" because background loads
    // don't fire "load" events.
    iframe.addEventListener("DOMContentLoaded", parseHandler, true);
    var uriLoader = Cc["@mozilla.org/uriloader;1"].getService(Ci.nsIURILoader);
    uriLoader.openURI(channel, true, iframe.docShell);
}

exports.loadHTML = function(url, values, callback) {
    request.Request({
        url: url,
        content: values,
        onComplete: function(response) {
            // Only way to parse HTML is by loading it in a hidden iframe
            // See https://developer.mozilla.org/en/Parsing_HTML_From_Chrome
            var ios = Cc["@mozilla.org/network/io-service;1"].
                      getService(Ci.nsIIOService);
            loadHTMLText(response.text, ios.newURI(url, null, null), callback);
        }
    }).post();
};

exports.parseBookmarks = function(document) {
    var top = document.getElementsByTagName("dl")[0];
    
    // Parsing this can be tricky. <dt> contains the actual bookmark itself
    // but sometimes it is followed by a <dd> which is a description for it.
    // If we encounter a <dt> but no <dd> immediately following it, it means
    // the user did not enter any 'notes' for the bookmark. Also note that
    // the HTML is not well-formed (no closing tags) so we are relying on
    // Gecko's tolerance for malformed HTML. Yay!
    var bmks = [];
    var nodes = top.childNodes;
    for (var i = 0; i < nodes.length; i++) {
        var cur = nodes[i];
        if (cur.nodeName == "DT") {
            var link = cur.getElementsByTagName('a')[0];
            bmks.push({
                'href': link.getAttribute('HREF'),
                'date': link.getAttribute('ADD_DATE'),
                'name': link.innerHTML
            });
            if (link.hasAttribute('TAGS')) {
                bmks[bmks.length-1]['tags'] =
                    link.getAttribute('TAGS');
            }
            if (link.hasAttribute('LAST_MODIFIED')) {
                bmks[bmks.length-1]['modified'] =
                    link.getAttribute('LAST_MODIFIED');
            }
        } else if (cur.nodeName == "DD") {
            if (bmks[bmks.length-1])
                bmks[bmks.length-1]['desc'] = cur.innerHTML;
        }
    }
    
    return bmks;
};
