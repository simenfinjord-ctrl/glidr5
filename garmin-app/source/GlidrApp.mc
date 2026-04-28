using Toybox.Application;
using Toybox.WatchUi;

class GlidrApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
    }

    function onStop(state) {
    }

    function getInitialView() {
        var view = new CodeEntryView();
        var delegate = new CodeEntryDelegate(view);
        return [view, delegate];
    }
}
