using Toybox.Application;
using Toybox.WatchUi;
using Toybox.Application.Storage;

class GlidrApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
    }

    function onStop(state) {
    }

    function getInitialView() {
        // Check if we have a stored team PIN
        var pin = Storage.getValue("teamPin");
        if (pin != null && pin instanceof String && pin.length() == 4) {
            // Go straight to main menu
            var view = new MainMenuView(pin);
            var delegate = new MainMenuDelegate(view);
            return [view, delegate];
        } else {
            // First time: enter team PIN
            var view = new PinSetupView();
            var delegate = new PinSetupDelegate(view);
            return [view, delegate];
        }
    }
}
