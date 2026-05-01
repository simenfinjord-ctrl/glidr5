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
        var pin = Storage.getValue("teamPin");
        var userCode = Storage.getValue("userCode");
        var hasPin = (pin != null && pin instanceof String && pin.length() == 4);
        var hasCode = (userCode != null && userCode instanceof String && userCode.length() == 4);

        if (hasPin && hasCode) {
            // Fully logged in — go straight to main menu
            var view = new MainMenuView(pin);
            var delegate = new MainMenuDelegate(view);
            return [view, delegate];
        } else {
            // Not fully logged in — start login: personal ID first, then team PIN
            var view = new PersonalCodeView();
            view.isLoginMode = true;
            var delegate = new PersonalCodeDelegate(view, null, null, true);
            return [view, delegate];
        }
    }
}
