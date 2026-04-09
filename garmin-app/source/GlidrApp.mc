using Toybox.Application;
using Toybox.WatchUi;
using Toybox.Application.Properties;

class GlidrApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {
    }

    function onStop(state as Dictionary?) as Void {
    }

    function getInitialView() as [Views] or [Views, InputDelegates] {
        var garminId = "";
        try {
            garminId = Properties.getValue("garminUserId") as String;
        } catch (e) {
            garminId = "";
        }

        if (garminId != null && !garminId.equals("")) {
            var view = new AutoConnectView(garminId);
            var delegate = new AutoConnectDelegate(view);
            return [view, delegate];
        } else {
            var view = new CodeEntryView();
            var delegate = new CodeEntryDelegate(view);
            return [view, delegate];
        }
    }
}
