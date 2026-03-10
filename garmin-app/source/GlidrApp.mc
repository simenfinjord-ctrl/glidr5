using Toybox.Application;
using Toybox.WatchUi;

class GlidrApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {
    }

    function onStop(state as Dictionary?) as Void {
    }

    function getInitialView() as [Views] or [Views, InputDelegates] {
        var view = new CodeEntryView();
        var delegate = new CodeEntryDelegate(view);
        return [view, delegate];
    }
}
