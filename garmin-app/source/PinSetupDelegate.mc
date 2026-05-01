// PinSetupDelegate.mc — handles input for team PIN entry.
// In login flow (userCode != null): uses POST /api/watch/auth to validate both codes.
// In settings "Change PIN" (userCode from storage): also uses /api/watch/auth.
// fromSettings=true: back button returns to settings instead of personal code entry.

using Toybox.WatchUi;
using Toybox.Communications;
using Toybox.Application.Storage;

class PinSetupDelegate extends WatchUi.BehaviorDelegate {
    var view;
    var userCode;       // personal watch code (entered in step 1 or from storage)
    var fromSettings;   // true when opened from Settings "Change PIN"

    // userCode and fromSettings default to null/false when called with fewer args
    function initialize(v, uc, fs) {
        BehaviorDelegate.initialize();
        view = v;
        userCode = uc;
        fromSettings = (fs == true);
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
        if (fromSettings) {
            // Return to settings
            var pin = Storage.getValue("teamPin");
            var settingsView = new SettingsView();
            var settingsDelegate = new SettingsDelegate(settingsView, pin);
            WatchUi.switchToView(settingsView, settingsDelegate, WatchUi.SLIDE_RIGHT);
        } else if (userCode != null) {
            // Return to personal ID entry (login flow, step 1)
            var codeView = new PersonalCodeView();
            codeView.isLoginMode = true;
            var codeDelegate = new PersonalCodeDelegate(codeView, null, null, true);
            WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_RIGHT);
        }
        return true;
    }

    // MENU button: open settings without losing progress
    function onMenu() {
        var settingsView = new SettingsView();
        var settingsDelegate = new SettingsDelegate(settingsView, null);
        WatchUi.switchToView(settingsView, settingsDelegate, WatchUi.SLIDE_LEFT);
        return true;
    }

    function verifyPin() {
        view.isVerifying = true;
        view.statusText = "Verifying...";
        WatchUi.requestUpdate();

        var pin = view.getPin();

        // Resolve the userCode to use: from login flow, or fall back to stored code
        var effectiveCode = userCode;
        if (effectiveCode == null) {
            effectiveCode = Storage.getValue("userCode");
        }

        if (effectiveCode != null) {
            // Authenticate both personal code + team PIN together
            var url = ServerConfig.BASE_URL + "/api/watch/auth";
            var body = { "userCode" => effectiveCode, "teamPin" => pin };
            Communications.makeWebRequest(
                url,
                body,
                {
                    :method => Communications.HTTP_REQUEST_METHOD_POST,
                    :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
                    :headers => { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON }
                },
                method(:onAuthResponse)
            );
        } else {
            // No personal code at all — fall back to team-only resolve (legacy)
            var url = ServerConfig.BASE_URL + "/api/watch/resolve/" + pin;
            Communications.makeWebRequest(
                url,
                null,
                {
                    :method => Communications.HTTP_REQUEST_METHOD_GET,
                    :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
                },
                method(:onLegacyResponse)
            );
        }
    }

    function onAuthResponse(responseCode, data) {
        view.isVerifying = false;

        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            // Success — store all credentials and go to main menu
            Storage.setValue("userCode", userCode != null ? userCode : Storage.getValue("userCode"));
            Storage.setValue("userName", data["userName"]);
            Storage.setValue("teamPin", view.getPin());
            Storage.setValue("teamName", data["teamName"]);

            var menuView = new MainMenuView(view.getPin());
            var menuDelegate = new MainMenuDelegate(menuView);
            WatchUi.switchToView(menuView, menuDelegate, WatchUi.SLIDE_LEFT);

        } else if (responseCode == 403 && data != null && data instanceof Dictionary) {
            var msg = data["message"];
            view.statusText = (msg != null) ? msg : "Access denied";
            view.cursorPos = 0;
            WatchUi.requestUpdate();

        } else if (responseCode == 404 && data != null && data instanceof Dictionary) {
            var msg = data["message"];
            if (msg != null && msg instanceof String) {
                view.statusText = msg;
            } else {
                view.statusText = "Not found!";
            }
            view.cursorPos = 0;
            WatchUi.requestUpdate();

        } else {
            view.statusText = "Error. Try again.";
            view.cursorPos = 0;
            WatchUi.requestUpdate();
        }
    }

    // Legacy fallback: only team PIN, no personal code validation
    function onLegacyResponse(responseCode, data) {
        view.isVerifying = false;
        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            Storage.setValue("teamPin", view.getPin());
            Storage.setValue("teamName", data["teamName"]);
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
