const {Cc, Ci, Cu} = require("chrome");

var Pl = {};
Cu.import("resource://gre/modules/PlacesUIUtils.jsm", Pl);

exports.importBookmarks = function(bmks) {
    var bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].
                getService(Ci.nsINavBookmarksService);
    var tgsvc = Cc["@mozilla.org/browser/tagging-service;1"].
                getService(Ci.nsITaggingService);
    var iosvc = Cc["@mozilla.org/network/io-service;1"].
                getService(Ci.nsIIOService);
    
    // Create a folder so the user can organize them later on
    // TODO: Incorporate delicious' "tag bundles" into folders
    var folder = bmsvc.createFolder(
        bmsvc.bookmarksMenuFolder,
        "del.icio.us",
        bmsvc.DEFAULT_INDEX
    );
    
    var count = 0;
    for (var i = 0; i < bmks.length; i++) {
        var bmk = bmks[i];
        var uri = iosvc.newURI(bmk['href'], null, null);
        
        // Don't add bookmarks already present
        if (!bmsvc.isBookmarked(uri)) {
            var bmkid = bmsvc.insertBookmark(
                folder, uri, bmsvc.DEFAULT_INDEX, bmk['name']
            );
            
            // Set bookmark metadata
            try {
                bmsvc.setItemDateAdded(bmkid, bmk['date']);
                if ('modified' in bmk) {
                    bmsvc.setItemLastModified(bmkid, bmk['modified']);
                }
                if ('desc' in bmk) {
                    Pl.PlacesUIUtils.ptm.editItemDescription(
                        bmkid, bmk['desc']
                    ).doTransaction();
                }
                if ('tags' in bmk) {
                    var tags = bmk['tags'].split(',');
                    if (typeof tags == typeof [] && tags.length != 0)
                        tgsvc.tagURI(uri, tags);
                }
            } catch (e) {
                console.log("could not add metadata " + e.toString());
            }
            count++;
        }
    }
    
    return count;
};
