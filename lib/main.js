var data = require("self").data;
var tabs = require("tabs");
var panel = require("panel");
var pageMod = require("page-mod");
var storage = require("simple-storage");

var state = 0x0;
const exportURL = "https://secure.delicious.com/settings/bookmarks/export";

var mainPanel = panel.Panel({
  width: 450, height: 300,
  contentURL: data.url("panel.html"),
  contentScriptWhen: "ready",
  contentScriptFile: data.url("panel.js"),
  
  onMessage: function handleMessage(msg) {
    console.log("addon received message!")
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
  contentScriptWhen: "ready",
  contentScriptFile: data.url("slurp.js"),
  
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
      if (state == 0x0) mainPanel.show();
      if (state == 0x1 && url == exportURL) importPanel.show();
      console.log(url);
    });
  }
});
