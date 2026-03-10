using Toybox.WatchUi;
using Toybox.Communications;
using Toybox.System;
using Toybox.Timer;

class HeatDelegate extends WatchUi.BehaviorDelegate {
    var view as HeatView;

    function initialize(v as HeatView) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onNextPage() as Boolean {
        if (view.allDone || view.isSending) { return true; }

        if (view.phase == 0) {
            view.selectedWinner = view.pairA;
            view.phase = 1;
            view.distance = 10;
            WatchUi.requestUpdate();
        } else if (view.phase == 1) {
            view.distance += 10;
            if (view.distance > 990) { view.distance = 990; }
            WatchUi.requestUpdate();
        }
        return true;
    }

    function onPreviousPage() as Boolean {
        if (view.allDone || view.isSending) { return true; }

        if (view.phase == 0) {
            view.selectedWinner = view.pairB;
            view.phase = 1;
            view.distance = 10;
            WatchUi.requestUpdate();
        } else if (view.phase == 1) {
            view.distance -= 10;
            if (view.distance < 10) { view.distance = 10; }
            WatchUi.requestUpdate();
        }
        return true;
    }

    function onSelect() as Boolean {
        if (view.allDone || view.isSending) { return true; }

        if (view.phase == 1) {
            submitResult();
        }
        return true;
    }

    function onBack() as Boolean {
        if (view.phase == 1) {
            view.phase = 0;
            view.distance = 0;
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    function submitResult() as Void {
        view.isSending = true;
        WatchUi.requestUpdate();

        var url = ServerConfig.BASE_URL + "/api/runsheet/watch/" + view.sessionCode + "/result";

        var body = {
            "roundIndex" => view.roundIndex,
            "heatIndex" => view.heatIndex,
            "winnerPair" => view.selectedWinner,
            "loserDistance" => view.distance
        };

        Communications.makeWebRequest(
            url,
            body,
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
                :headers => {
                    "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON
                }
            },
            method(:onSubmitResponse)
        );
    }

    function onSubmitResponse(responseCode as Number, data as Dictionary or Null or String) as Void {
        view.isSending = false;

        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            if (data["nextHeat"] != null && data["nextHeat"] instanceof Dictionary) {
                var nh = data["nextHeat"] as Dictionary;
                view.roundName = nh["roundName"] as String;
                view.pairA = nh["pairA"] as Number;
                view.pairB = nh["pairB"] as Number;
                view.roundIndex = nh["roundIndex"] as Number;
                view.heatIndex = nh["heatIndex"] as Number;
                view.statusText = "Select winner";
                view.phase = 0;
                view.distance = 0;
            } else {
                view.allDone = true;
            }
        } else {
            view.statusText = "Error! Try again";
            view.phase = 0;
        }

        WatchUi.requestUpdate();
    }
}
