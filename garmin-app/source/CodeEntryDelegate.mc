using Toybox.WatchUi;
using Toybox.Communications;

class CodeEntryDelegate extends WatchUi.BehaviorDelegate {
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
        } else {
            view.statusText = "Invalid code!";
            view.cursorPos = 0;
            WatchUi.requestUpdate();
        }
    }
}
