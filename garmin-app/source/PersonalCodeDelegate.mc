// PersonalCodeDelegate.mc — handles input for personal watch code entry

using Toybox.WatchUi;
using Toybox.Communications;
using Toybox.Application.Storage;

class PersonalCodeDelegate extends WatchUi.BehaviorDelegate {
    var view;
    var settingsView;  // reference to settings view to refresh after save
    var teamPin;

    function initialize(v, sv, pin) {
        BehaviorDelegate.initialize();
        view = v;
        settingsView = sv;
        teamPin = pin;
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
            verifyCode();
        }
        return true;
    }

    function onBack() {
        if (view.cursorPos > 0) {
            view.cursorPos--;
            WatchUi.requestUpdate();
            return true;
        }
        // Cancel — return to settings
        WatchUi.switchToView(settingsView, new SettingsDelegate(settingsView, teamPin), WatchUi.SLIDE_RIGHT);
        return true;
    }

    function verifyCode() {
        view.statusText = "Verifying...";
        WatchUi.requestUpdate();

        var code = view.getCode();
        var url = ServerConfig.BASE_URL + "/api/watch/resolve-user/" + code;

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
        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            var userName = data["userName"];
            Storage.setValue("userCode", view.getCode());
            Storage.setValue("userName", userName);
            view.statusText = "Saved!";
            WatchUi.requestUpdate();
            // Return to settings after a moment
            var backView = new SettingsView();
            var backDelegate = new SettingsDelegate(backView, teamPin);
            WatchUi.switchToView(backView, backDelegate, WatchUi.SLIDE_RIGHT);
        } else if (responseCode == 404) {
            view.statusText = "Code not found!";
            view.cursorPos = 0;
            WatchUi.requestUpdate();
        } else {
            view.statusText = "Error. Try again.";
            view.cursorPos = 0;
            WatchUi.requestUpdate();
        }
    }
}
