// SettingsDelegate.mc — handles input for settings screen (5 items)

using Toybox.WatchUi;
using Toybox.Application.Storage;

class SettingsDelegate extends WatchUi.BehaviorDelegate {
    var view;
    var teamPin;

    function initialize(v, pin) {
        BehaviorDelegate.initialize();
        view = v;
        teamPin = pin;
    }

    function onNextPage() {
        view.selectedIndex = (view.selectedIndex + 1) % 5;
        WatchUi.requestUpdate();
        return true;
    }

    function onPreviousPage() {
        view.selectedIndex = (view.selectedIndex + 4) % 5;
        WatchUi.requestUpdate();
        return true;
    }

    function onSelect() {
        if (view.selectedIndex == 0) {
            // Toggle vibrate
            view.vibrateOn = !view.vibrateOn;
            Storage.setValue("vibrate", view.vibrateOn);
            WatchUi.requestUpdate();

        } else if (view.selectedIndex == 1) {
            // Toggle key sounds
            view.keySoundsOn = !view.keySoundsOn;
            Storage.setValue("keySounds", view.keySoundsOn);
            WatchUi.requestUpdate();

        } else if (view.selectedIndex == 2) {
            // Change personal watch code
            var codeView = new PersonalCodeView();
            var codeDelegate = new PersonalCodeDelegate(codeView, view, teamPin, false);
            WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_LEFT);

        } else if (view.selectedIndex == 3) {
            // Change team PIN — validate with stored personal code + new PIN
            var storedCode = Storage.getValue("userCode");
            var pinView = new PinSetupView();
            pinView.loginUserCode = storedCode;
            pinView.statusText = "Enter new team PIN";
            var pinDelegate = new PinSetupDelegate(pinView, storedCode, true);
            WatchUi.switchToView(pinView, pinDelegate, WatchUi.SLIDE_LEFT);

        } else if (view.selectedIndex == 4) {
            // Log Out — clear all credentials and return to login
            Storage.deleteValue("teamPin");
            Storage.deleteValue("teamName");
            Storage.deleteValue("userCode");
            Storage.deleteValue("userName");
            var codeView = new PersonalCodeView();
            codeView.isLoginMode = true;
            var codeDelegate = new PersonalCodeDelegate(codeView, null, null, true);
            WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_LEFT);
        }
        return true;
    }

    function onBack() {
        if (teamPin != null) {
            // Return to main menu
            var menuView = new MainMenuView(teamPin);
            var menuDelegate = new MainMenuDelegate(menuView);
            WatchUi.switchToView(menuView, menuDelegate, WatchUi.SLIDE_RIGHT);
        } else {
            // No PIN stored — return to login (personal ID entry)
            var codeView = new PersonalCodeView();
            codeView.isLoginMode = true;
            var codeDelegate = new PersonalCodeDelegate(codeView, null, null, true);
            WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_RIGHT);
        }
        return true;
    }
}
