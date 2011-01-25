var data = require("self").data;
var tabs = require("tabs");
var panel = require("panel");
var parse = require("parse");
var places = require("places");
var pageMod = require("page-mod");
var storage = require("simple-storage");

const STATE_FRESH = 0x0;    // New install
const STATE_INTENT = 0x1;   // User has asked to import
const STATE_DONE = 0x2;     // Import completed

if (!('state' in storage))
    storage.state = STATE_FRESH;

const exportURL = "https://secure.delicious.com/settings/bookmarks/export";
const exportPostURL = "https://secure.delicious.com/settings/profile/export";

var mainPanel = panel.Panel({
    width: 480, height: 350,
    contentURL: data.url("panel.html"),
    contentScriptWhen: "ready",
    contentScript: "document.getElementById('start').onclick = function() {" +
                   "    postMessage('begin');" +
                   "};",
    
    onMessage: function handleMessage(msg) {
        if (msg == "begin") {
            storage.state = STATE_INTENT;
            mainPanel.hide();
            tabs.activeTab.url = exportURL;
        }
    }
});

var exportPanel = panel.Panel({
    width: 480, height: 300,
    contentURL: data.url("export.html")
});

var importPanel = panel.Panel({
    width: 480, height: 300,
    contentURL: data.url("import.html"),
});

pageMod.PageMod({
    include: ["*.delicious.com"],
    contentScriptWhen: "ready",
    contentScript: "postMessage(window.location.toString());",
    
    onAttach: function onAttach(worker, mod) {
        worker.on("message", function(url) {
            // exportURL is handled by next pageMod
            if (url != exportURL) {
                if (storage.state == STATE_FRESH) mainPanel.show();
            }
        });
    }
});

pageMod.PageMod({
    include: [exportURL],
    contentScriptWhen: "ready",
    contentScript: "onMessage = function onMessage(msg) {" +
                   "    document.getElementsByName('submit')[0].innerHTML " +
                   "    = msg;" +
                   "};" +
                   "var export = document.getElementsByName('submit')[0];" +
                   "export.onclick = function() { " +
                   "    var body = {};" +
                   "    var wait = document.createElement('button');" +
                   "    for (var i = 0; i < export.form.elements.length; i++) {" +
                   "        var current = export.form.elements.item(i);" +
                   "        if (current.nodeName == 'INPUT') {" +
                   "            body[current.name] = current.value;" +
                   "        }" +
                   "    }" +
                   "    wait.name = 'submit';" +
                   "    wait.innerHTML = 'Please Wait...';" +
                   "    export.parentNode.replaceChild(wait, export);" +
                   "    postMessage(body); return false;" +
                   "};" +
                   "postMessage('show');",
    
    onAttach: function onAttach(worker, mod) {
        worker.on("message", function(values) {
            if (storage.state != STATE_INTENT) return;
            if (values == 'show') {
                exportPanel.show();
            } else {
                parse.loadHTML(exportPostURL, values, function(doc) {
                    places.importBookmarks(parse.parseBookmarks(doc));
                    worker.postMessage('Done!');
                    importPanel.show();
                    storage.state = STATE_DONE;
                });
            }
        });
    }
});
