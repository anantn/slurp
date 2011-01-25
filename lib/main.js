var data = require("self").data;
var tabs = require("tabs");
var panel = require("panel");
var parse = require("parse");
var places = require("places");
var pageMod = require("page-mod");
var storage = require("simple-storage");

var state = 0x0;
const exportURL = "https://secure.delicious.com/settings/bookmarks/export";
const exportPostURL = "https://secure.delicious.com/settings/profile/export";

var mainPanel = panel.Panel({
    width: 450, height: 300,
    contentURL: data.url("panel.html"),
    contentScriptWhen: "ready",
    contentScript: "document.getElementById('start').onclick = function() {" +
                   "    postMessage('begin');" +
                   "};",
    
    onMessage: function handleMessage(msg) {
        switch (msg) {
            case "begin":
                state = 0x1;
                mainPanel.hide();
                tabs.activeTab.url = exportURL;
                break;
            case "process":
                break;
        }
    }
});

var importPanel = panel.Panel({
    width: 450, height: 300,
    contentURL: data.url("import.html"),
    
    onMessage: function handleMessage(msg) {
        console.log("got msg " + msg);
    }
});

pageMod.PageMod({
    include: ["*.delicious.com"],
    contentScriptWhen: "ready",
    contentScript: "postMessage(window.location.toString());",
    
    onAttach: function onAttach(worker, mod) {
        worker.on("message", function(url) {
            // exportURL is handled by next pageMod
            if (url != exportURL) {
                if (state == 0x0) mainPanel.show();
            }
        });
    }
});

pageMod.PageMod({
    include: [exportURL],
    contentScriptWhen: "ready",
    contentScript: "var export = document.getElementsByName('submit')[0];" +
                   "export.onclick = function() { " +
                   "    var body = {};" +
                   "    for (var i = 0; i < export.form.elements.length; i++) {" +
                   "        var current = export.form.elements.item(i);" +
                   "        if (current.nodeName == 'INPUT') {" +
                   "            body[current.name] = current.value;" +
                   "        }" +
                   "    }" +
                   "    postMessage(body); return false;" +
                   "}",
    
    onAttach: function onAttach(worker, mod) {
        worker.on("message", function(values) {
            if (state != 0x1) return;
            parse.loadHTML(exportPostURL, values, function(doc) {
                var count = places.importBookmarks(parse.parseBookmarks(doc));
                console.log("Successfully imported " + count);
            });
        });
    }
});
