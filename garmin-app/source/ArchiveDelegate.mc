// ArchiveDelegate.mc — handles navigation in archive and re-runs a completed session

using Toybox.WatchUi;
using Toybox.Communications;
using Toybox.Application.Storage;

class ArchiveDelegate extends WatchUi.BehaviorDelegate {
    var view;
    var isResuming = false;

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
        if (view.isLoading || isResuming || view.items.size() == 0) { return true; }

        var item = view.items[view.selectedIndex];
        isResuming = true;
        view.statusText = "Starting...";
        WatchUi.requestUpdate();

        var itemId = item["id"].toString();
        var url = ServerConfig.BASE_URL + "/api/watch/list/" + view.teamPin + "/start/" + itemId;

        var body = {};
        var userCode = Storage.getValue("userCode");
        if (userCode != null) {
            body = { "userCode" => userCode };
        }

        Communications.makeWebRequest(
            url,
            body,
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
        isResuming = false;
        view.statusText = "";
        WatchUi.requestUpdate();

        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            var code = data["code"];
            var queueItemId = data["queueItemId"];
            if (code != null) {
                var heatView = new HeatView(code);
                heatView.queueItemId = queueItemId;
                heatView.teamPin = view.teamPin;
                heatView.statusText = "Select winner";
                // Fetch current heat state before showing
                var heatUrl = ServerConfig.BASE_URL + "/api/runsheet/watch/" + code;
                Communications.makeWebRequest(
                    heatUrl,
                    null,
                    {
                        :method => Communications.HTTP_REQUEST_METHOD_GET,
                        :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
                    },
                    new HeatLoadCallback(heatView, view.teamPin).method(:onResponse)
                );
            } else {
                view.statusText = "No entries yet";
                WatchUi.requestUpdate();
            }
        } else {
            view.statusText = "Error. Try again.";
            WatchUi.requestUpdate();
        }
    }

    function onBack() {
        var menuView = new MainMenuView(view.teamPin);
        var menuDelegate = new MainMenuDelegate(menuView);
        WatchUi.switchToView(menuView, menuDelegate, WatchUi.SLIDE_RIGHT);
        return true;
    }
}
