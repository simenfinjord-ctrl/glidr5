// SettingsDelegate.mc — handles input for settings screen

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
        view.selectedIndex = (view.selectedIndex + 1) % 4;
        WatchUi.requestUpdate();
        return true;
    }

    function onPreviousPage() {
        view.selectedIndex = (view.selectedIndex + 3) % 4;
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
            // Enter personal watch code
            var codeView = new PersonalCodeView();
            var codeDelegate = new PersonalCodeDelegate(codeView, view, teamPin);
            WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_LEFT);
        } else if (view.selectedIndex == 3) {
            // Change PIN: clear stored PIN and go to setup
            Storage.deleteValue("teamPin");
            Storage.deleteValue("teamName");
            Storage.deleteValue("userCode");
            Storage.deleteValue("userName");
            var setupView = new PinSetupView();
            var setupDelegate = new PinSetupDelegate(setupView);
            WatchUi.switchToView(setupView, setupDelegate, WatchUi.SLIDE_LEFT);
        }
        return true;
    }

    function onBack() {
        if (teamPin != null) {
            // Return to main menu if we have a PIN
            var menuView = new MainMenuView(teamPin);
            var menuDelegate = new MainMenuDelegate(menuView);
            WatchUi.switchToView(menuView, menuDelegate, WatchUi.SLIDE_RIGHT);
        } else {
            // Return to PIN setup if accessed without a PIN
            var pinView = new PinSetupView();
            var pinDelegate = new PinSetupDelegate(pinView);
            WatchUi.switchToView(pinView, pinDelegate, WatchUi.SLIDE_RIGHT);
        }
        return true;
    }
}
