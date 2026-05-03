using Toybox.WatchUi;
using Toybox.Communications;
using Toybox.Application.Storage;

class CodeEntryDelegate extends WatchUi.BehaviorDelegate {
    var view;
    // Set by QueueListDelegate when navigating from list (so HeatView can auto-complete)
    var pendingQueueItemId = null;
    var teamPin = null;

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
            connectToSession();
        }
        return true;
    }

    function onBack() {
        if (view.cursorPos > 0) {
            view.cursorPos--;
            WatchUi.requestUpdate();
            return true;
        }
        // Go back to main menu if PIN is set
        var pin = teamPin != null ? teamPin : Storage.getValue("teamPin");
        if (pin != null && pin instanceof String && pin.length() == 4) {
            var menuView = new MainMenuView(pin);
            var menuDelegate = new MainMenuDelegate(menuView);
            WatchUi.switchToView(menuView, menuDelegate, WatchUi.SLIDE_RIGHT);
            return true;
        }
        return false;
    }

    function connectToSession() {
        view.isConnecting = true;
        view.statusText = "Connecting...";
        WatchUi.requestUpdate();

        var code = view.getCode();
        var url = ServerConfig.BASE_URL + "/api/runsheet/watch/" + code;

        Communications.makeWebRequest(
            url,
            null,
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onConnectResponse)
        );
    }

    function onConnectResponse(responseCode, data) {
        view.isConnecting = false;

        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            var code = view.getCode();
            var heatView = new HeatView(code);

            // Pass queue context if navigated from list
            heatView.queueItemId = pendingQueueItemId;
            heatView.teamPin = teamPin != null ? teamPin : Storage.getValue("teamPin");

            if (data["currentHeat"] != null && data["currentHeat"] instanceof Dictionary) {
                var ch = data["currentHeat"];
                heatView.roundName = ch["roundName"];
                heatView.pairA = ch["pairA"];
                heatView.pairB = ch["pairB"];
                heatView.labelA = ch["labelA"] != null ? ch["labelA"] : ch["pairA"].toString();
                heatView.labelB = ch["labelB"] != null ? ch["labelB"] : ch["pairB"].toString();
                heatView.roundIndex = ch["roundIndex"];
                heatView.heatIndex = ch["heatIndex"];
                heatView.statusText = "Select winner";
            } else if (data["complete"] == true) {
                heatView.statusText = "All heats complete!";
                heatView.allDone = true;
            } else {
                heatView.statusText = "Waiting for heats...";
            }

            var heatDelegate = new HeatDelegate(heatView);
            WatchUi.switchToView(heatView, heatDelegate, WatchUi.SLIDE_LEFT);
        } else if (responseCode == 404) {
            view.statusText = "Code expired!";
            view.cursorPos = 0;
            WatchUi.requestUpdate();
        } else {
            view.statusText = "Error " + responseCode.toString();
            view.cursorPos = 0;
            WatchUi.requestUpdate();
        }
    }
}
