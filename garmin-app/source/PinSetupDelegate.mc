// PinSetupDelegate.mc — handles input for team PIN setup

using Toybox.WatchUi;
using Toybox.Communications;
using Toybox.Application.Storage;

class PinSetupDelegate extends WatchUi.BehaviorDelegate {
    var view;

    function initialize(v) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onNextPage() {
        view.digits[view.cursorPos] = (view.digits[view.cursorPos] + 1) % 10;
        WatchUi.requestUpdate();
        return true;
    }

    function onPreviousPage() {
        view.digits[view.cursorPos] = (view.digits[view.cursorPos] + 9) % 10;
        WatchUi.requestUpdate();
        return true;
    }

    function onSelect() {
        if (view.cursorPos < 3) {
            view.cursorPos++;
            WatchUi.requestUpdate();
        } else {
            verifyPin();
        }
        return true;
    }

    function onBack() {
        if (view.cursorPos > 0) {
            view.cursorPos--;
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    function verifyPin() {
        view.isVerifying = true;
        view.statusText = "Verifying...";
        WatchUi.requestUpdate();

        var pin = view.getPin();
        var url = ServerConfig.BASE_URL + "/api/watch/resolve/" + pin;

        Communications.makeWebRequest(
            url,
            null,
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onVerifyResponse)
        );
    }

    function onVerifyResponse(responseCode, data) {
        view.isVerifying = false;

        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            // Save PIN to persistent storage
            Storage.setValue("teamPin", view.getPin());
            Storage.setValue("teamName", data["teamName"]);

            // Switch to main menu
            var menuView = new MainMenuView(view.getPin());
            var menuDelegate = new MainMenuDelegate(menuView);
            WatchUi.switchToView(menuView, menuDelegate, WatchUi.SLIDE_LEFT);
        } else {
            view.statusText = "Invalid PIN!";
            view.cursorPos = 0;
            WatchUi.requestUpdate();
        }
    }
}
