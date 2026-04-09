using Toybox.WatchUi;
using Toybox.Communications;
using Toybox.System;
using Toybox.Timer;
using Toybox.Application.Properties;

class AutoConnectDelegate extends WatchUi.BehaviorDelegate {
    var view as AutoConnectView;
    var pollTimer as Timer.Timer?;
    var retryCount as Number = 0;
    var garminToken as String = "";

    function initialize(v as AutoConnectView) {
        BehaviorDelegate.initialize();
        view = v;
        try {
            garminToken = Properties.getValue("garminToken") as String;
        } catch (e) {
            garminToken = "";
        }
        if (garminToken != null && !garminToken.equals("")) {
            tryAutoConnect();
        } else {
            view.statusText = "No session token";
            view.isConnecting = false;
            WatchUi.requestUpdate();
        }
    }

    function tryAutoConnect() as Void {
        view.statusText = "Searching for session...";
        view.isConnecting = true;
        WatchUi.requestUpdate();

        var url = ServerConfig.BASE_URL + "/api/runsheet/watch/garmin/" + view.garminId + "?token=" + garminToken;

        Communications.makeWebRequest(
            url,
            null,
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onAutoConnectResponse)
        );
    }

    function onAutoConnectResponse(responseCode as Number, data as Dictionary or Null or String) as Void {
        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            var code = data["code"] as String;
            view.sessionCode = code;
            view.statusText = "Connected!";
            view.isConnecting = false;
            WatchUi.requestUpdate();

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
        } else if (responseCode == 404) {
            retryCount++;
            if (retryCount < 30) {
                view.statusText = "Waiting for session...";
                WatchUi.requestUpdate();
                pollTimer = new Timer.Timer();
                pollTimer.start(method(:onPollTimer), 3000, false);
            } else {
                view.statusText = "No session found";
                view.isConnecting = false;
                WatchUi.requestUpdate();
            }
        } else {
            view.statusText = "Connection failed";
            view.isConnecting = false;
            WatchUi.requestUpdate();
        }
    }

    function onPollTimer() as Void {
        tryAutoConnect();
    }

    function onBack() as Boolean {
        if (pollTimer != null) {
            pollTimer.stop();
            pollTimer = null;
        }
        var codeView = new CodeEntryView();
        var codeDelegate = new CodeEntryDelegate(codeView);
        WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_RIGHT);
        return true;
    }

    function onSelect() as Boolean {
        if (!view.isConnecting) {
            tryAutoConnect();
            retryCount = 0;
        }
        return true;
    }
}
