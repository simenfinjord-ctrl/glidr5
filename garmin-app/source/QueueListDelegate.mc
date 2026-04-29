// QueueListDelegate.mc — handles navigation and selection in queue list

using Toybox.WatchUi;
using Toybox.Communications;

class QueueListDelegate extends WatchUi.BehaviorDelegate {
    var view;
    var isStarting = false;
    var selectedItem = null;

    function initialize(v) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onNextPage() {
        if (view.items.size() == 0) { return true; }
        if (view.selectedIndex < view.items.size() - 1) {
            view.selectedIndex++;
            WatchUi.requestUpdate();
        }
        return true;
    }

    function onPreviousPage() {
        if (view.items.size() == 0) { return true; }
        if (view.selectedIndex > 0) {
            view.selectedIndex--;
            WatchUi.requestUpdate();
        }
        return true;
    }

    function onSelect() {
        if (view.isLoading || isStarting) { return true; }

        // Empty list — refresh
        if (view.items.size() == 0) {
            view.fetchList();
            return true;
        }

        selectedItem = view.items[view.selectedIndex];
        isStarting = true;
        view.isLoading = true;  // reuse loading state to show spinner
        WatchUi.requestUpdate();

        var itemId = selectedItem["id"].toString();
        var url = ServerConfig.BASE_URL + "/api/watch/list/" + view.teamPin + "/start/" + itemId;

        Communications.makeWebRequest(
            url,
            {},
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
                :headers => { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON }
            },
            method(:onStartResponse)
        );
        return true;
    }

    function onStartResponse(responseCode, data) {
        isStarting = false;
        view.isLoading = false;

        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            var code = data["code"];
            var queueItemId = data["queueItemId"];

            if (code != null) {
                // Active session found — jump straight to heat view
                var heatView = new HeatView(code);
                heatView.queueItemId = queueItemId;
                heatView.teamPin = view.teamPin;
                heatView.statusText = "Select winner";
                fetchCurrentHeat(code, heatView);
            } else {
                // No active session for this test yet.
                // Navigate to code entry so user can enter session code from web app.
                var codeView = new CodeEntryView();
                codeView.statusText = "Enter session code";
                var codeDelegate = new CodeEntryDelegate(codeView);
                // Pass the queueItemId so HeatDelegate can mark it complete later
                codeDelegate.pendingQueueItemId = queueItemId;
                codeDelegate.teamPin = view.teamPin;
                WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_LEFT);
            }
        } else {
            // Server error — go to code entry as fallback
            var codeView = new CodeEntryView();
            codeView.statusText = "Enter session code";
            var codeDelegate = new CodeEntryDelegate(codeView);
            WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_LEFT);
        }
    }

    function fetchCurrentHeat(code, heatView) {
        var url = ServerConfig.BASE_URL + "/api/runsheet/watch/" + code;
        Communications.makeWebRequest(
            url,
            null,
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            new HeatLoadCallback(heatView, view.teamPin).method(:onResponse)
        );
    }

    function onBack() {
        var menuView = new MainMenuView(view.teamPin);
        var menuDelegate = new MainMenuDelegate(menuView);
        WatchUi.switchToView(menuView, menuDelegate, WatchUi.SLIDE_RIGHT);
        return true;
    }
}

// Helper callback class for loading heat data after starting from list
class HeatLoadCallback {
    var heatView;
    var teamPin;

    function initialize(view, pin) {
        heatView = view;
        teamPin = pin;
    }

    function onResponse(responseCode, data) {
        if (responseCode == 200 && data != null && data instanceof Dictionary) {
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
            }
        }
        var heatDelegate = new HeatDelegate(heatView);
        WatchUi.switchToView(heatView, heatDelegate, WatchUi.SLIDE_LEFT);
    }
}
