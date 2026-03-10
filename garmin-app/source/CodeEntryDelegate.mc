using Toybox.WatchUi;
using Toybox.Communications;
using Toybox.System;

class CodeEntryDelegate extends WatchUi.BehaviorDelegate {
    var view as CodeEntryView;

    function initialize(v as CodeEntryView) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onNextPage() as Boolean {
        view.digits[view.cursorPos] = (view.digits[view.cursorPos] + 1) % 10;
        WatchUi.requestUpdate();
        return true;
    }

    function onPreviousPage() as Boolean {
        view.digits[view.cursorPos] = (view.digits[view.cursorPos] + 9) % 10;
        WatchUi.requestUpdate();
        return true;
    }

    function onSelect() as Boolean {
        if (view.cursorPos < 5) {
            view.cursorPos++;
            WatchUi.requestUpdate();
        } else {
            connectToSession();
        }
        return true;
    }

    function onBack() as Boolean {
        if (view.cursorPos > 0) {
            view.cursorPos--;
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    function connectToSession() as Void {
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

    function onConnectResponse(responseCode as Number, data as Dictionary or Null or String) as Void {
        view.isConnecting = false;

        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            var code = view.getCode();
            var heatView = new HeatView(code);

            if (data["currentHeat"] != null && data["currentHeat"] instanceof Dictionary) {
                var ch = data["currentHeat"] as Dictionary;
                heatView.roundName = ch["roundName"] as String;
                heatView.pairA = ch["pairA"] as Number;
                heatView.pairB = ch["pairB"] as Number;
                heatView.roundIndex = ch["roundIndex"] as Number;
                heatView.heatIndex = ch["heatIndex"] as Number;
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
